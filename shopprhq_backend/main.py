import os
import asyncio
import logging
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.logging_config import setup_logging
from app.core.tenant import TenantMiddleware

# --------------------------------------------------
# LOGGING (MUST BE FIRST)
# --------------------------------------------------
setup_logging()
logger = logging.getLogger(__name__)

# --------------------------------------------------
# Lifespan
# --------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting ShopprHQ API")

    # Assert required environment variables are set before accepting traffic
    _startup_env = os.getenv("ENVIRONMENT", "production").lower()
    if _startup_env != "local":
        _required = {
            "META_APP_SECRET": os.getenv("META_APP_SECRET"),
            "PAYSTACK_SECRET_KEY": os.getenv("PAYSTACK_SECRET_KEY"),
            "PAYSTACK_WEBHOOK_SECRET": os.getenv("PAYSTACK_WEBHOOK_SECRET"),
        }
        _missing = [k for k, v in _required.items() if not v]
        if _missing:
            logger.critical("Missing required environment variables: %s", _missing)
            import sys; sys.exit(1)

    from app.api.v1.workers.stale_order_cleanup import run_cleanup_loop
    cleanup_task = asyncio.create_task(run_cleanup_loop())

    def _handle_cleanup_crash(t: asyncio.Task):
        if not t.cancelled() and t.exception():
            logger.error("Stale order cleanup worker crashed: %s", t.exception(), exc_info=True)

    cleanup_task.add_done_callback(_handle_cleanup_crash)
    logger.info("🔄 Stale order cleanup loop started")

    yield

    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass
    logger.info("🛑 Shutting down ShopprHQ API")

# --------------------------------------------------
# App Initialization
# --------------------------------------------------
app = FastAPI(
    title="ShopprHQ API",
    lifespan=lifespan,
)

# --------------------------------------------------
# MIDDLEWARES
# --------------------------------------------------

_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_allow_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
_env = os.getenv("ENVIRONMENT", "production").lower()

if not _allow_origins:
    if _env == "local":
        _allow_origins = ["*"]
        logger.warning("CORS is open — acceptable for local dev only")
    else:
        import sys
        logger.critical("ALLOWED_ORIGINS not set — refusing to start in production. "
                        "Set ALLOWED_ORIGINS in Railway Variables.")
        sys.exit(1)

if "*" in _allow_origins and _env != "local":
    import sys
    logger.critical("ALLOWED_ORIGINS is wildcard (*) in production — refusing to start.")
    sys.exit(1)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TenantMiddleware)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Unhandled exception: %s %s — %s",
        request.method, request.url.path, exc, exc_info=True,
    )
    try:
        from app.infrastructure.alerting.slack import alert
        asyncio.create_task(alert(
            title="Unhandled 500 Error",
            detail=f"`{request.method} {request.url.path}` raised an unhandled exception.",
            level="critical",
            fields={"error": str(exc)[:300]},
        ))
    except Exception:
        pass
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

@app.middleware("http")
async def trace_all_requests(request: Request, call_next):
    logger.info(f"🌐 {request.method} {request.url.path}")
    response = await call_next(request)
    return response

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )
    return response

# --------------------------------------------------
# Routers
# --------------------------------------------------
from app.api.v1.merchant import router as merchant_router
from app.api.v1.client_whatsapp_credential import router as whatsapp_cred_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.orders_api import router as orders_router
from app.api.v1.payment import router as payments_router
from app.api.v1.webhook import router as webhooks_router
from app.api.v1.client_api import router as client_router
from app.api.v1.product import router as product_router
from app.api.v1.checkout import router as checkout_router
from app.api.v1.debug import router as debug_router
from app.api.v1.subaccount import router as subaccount_router
from app.api.v1.admin_whatsapp import router as admin_whatsapp_router
from app.api.v1.paystack import router as paystack_router

API_V1_PREFIX = "/api/v1"

app.include_router(webhooks_router, prefix=API_V1_PREFIX, tags=["Webhooks"])
app.include_router(paystack_router, prefix="/api/v1")
app.include_router(merchant_router, prefix=API_V1_PREFIX, tags=["Merchants"])
app.include_router(whatsapp_cred_router, prefix=API_V1_PREFIX, tags=["WhatsApp Credentials"])
app.include_router(inventory_router, prefix=API_V1_PREFIX, tags=["Inventory"])
app.include_router(orders_router, prefix=API_V1_PREFIX, tags=["Orders"])
app.include_router(payments_router, prefix=API_V1_PREFIX, tags=["Payments"])
app.include_router(client_router, prefix=API_V1_PREFIX, tags=["Clients"])
app.include_router(product_router, prefix=API_V1_PREFIX, tags=["Products"])
app.include_router(checkout_router, prefix=API_V1_PREFIX, tags=["Checkout"])
app.include_router(debug_router, prefix=API_V1_PREFIX, tags=["Debug"])
app.include_router(subaccount_router, prefix=API_V1_PREFIX, tags=["Subaccounts"])

app.include_router(admin_whatsapp_router)

# --------------------------------------------------
# Health & Root
# --------------------------------------------------
@app.get("/", response_class=HTMLResponse)
async def root():
    """Landing page — home, registration, and T&C all in one."""
    _tpl = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    with open(_tpl, "r") as f:
        return HTMLResponse(content=f.read())

@app.get("/health")
async def health():
    return {"status": "healthy"}


# ── Merchant dashboard ─────────────────────────────────────────────────────────
# Must be registered BEFORE the StaticFiles mount so ?verified=1 query strings
# survive (StaticFiles redirects /dashboard → /dashboard/ and strips them).

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_index():
    _tpl = os.path.join(os.path.dirname(__file__), "templates", "dashboard", "dashboard_index.html")
    with open(_tpl, "r") as f:
        return HTMLResponse(content=f.read())

_dashboard_static = os.path.join(os.path.dirname(__file__), "templates", "dashboard")
app.mount("/dashboard", StaticFiles(directory=_dashboard_static, html=True), name="dashboard")


# ── Store (client) pages ───────────────────────────────────────────────────────
# Both routes must be registered before any StaticFiles mount that would catch them.

@app.get("/store-login", response_class=HTMLResponse)
async def store_login_page():
    """Standalone login page for store managers."""
    _tpl = os.path.join(os.path.dirname(__file__), "templates", "store_login.html")
    with open(_tpl, "r") as f:
        return HTMLResponse(content=f.read())


@app.get("/store-dashboard", response_class=HTMLResponse)
async def store_dashboard_page():
    """Store-scoped dashboard — loads after client JWT login."""
    _tpl = os.path.join(os.path.dirname(__file__), "templates", "store_dashboard", "index.html")
    with open(_tpl, "r") as f:
        return HTMLResponse(content=f.read())

# Serve store dashboard static assets (JS etc.)
_store_dash_static = os.path.join(os.path.dirname(__file__), "templates", "store_dashboard")
app.mount("/store-dashboard-static", StaticFiles(directory=_store_dash_static), name="store_dashboard")


# ── Global static assets ───────────────────────────────────────────────────────
_static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=_static_dir), name="static")


@app.get("/payment-success", response_class=HTMLResponse)
async def payment_success():
    """
    Flutterwave redirect landing page after customer completes payment.
    The real order confirmation is handled by the Flutterwave webhook.
    """
    html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0fdf4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 24px; color: #16a34a; margin-bottom: 8px; }
    p { color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-block;
      background: #25D366;
      color: white;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 600;
    }
    .note { margin-top: 16px; font-size: 13px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>Payment Successful!</h1>
    <p>Your order has been confirmed. Head back to WhatsApp — we're sending your order details right now.</p>
    <a class="btn" href="https://wa.me/{"".join(c for c in os.getenv("SHOPPRHQ_SUPPORT_WHATSAPP", "") if c.isdigit())}">↩ Back to WhatsApp</a>
    <p class="note">You can close this page after returning to your chat.</p>
  </div>
</body>
</html>"""
    return HTMLResponse(content=html)
