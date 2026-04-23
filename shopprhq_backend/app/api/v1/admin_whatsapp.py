# app/api/v1/admin_whatsapp.py
"""
Internal admin tool — WhatsApp number onboarding.
Protected by ADMIN_SECRET env var.
Accessible at /admin/whatsapp-setup
"""

import os
import secrets
import logging
import httpx

from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.deps import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/whatsapp-setup", tags=["Admin — WhatsApp Setup"])

GRAPH_URL = "https://graph.facebook.com/v20.0"

# ── CONFIG — all read from env, never sent to browser ─────────────────────────
def _cfg():
    return {
        "admin_secret":  os.getenv("ADMIN_SECRET", ""),
        "system_token":  os.getenv("META_SYSTEM_TOKEN", ""),
        "waba_id":       os.getenv("META_WABA_ID", ""),
        "app_url":       os.getenv("APP_URL", ""),
        "verify_token":  os.getenv("META_VERIFY_TOKEN", ""),
    }

# ── SESSION STORE (Redis-backed — survives restarts, expires after 4 h) ────────

async def _require_admin(request: Request):
    from app.core.redis_client import validate_admin_session
    token = request.headers.get("X-Admin-Token", "")
    if not token or not await validate_admin_session(token):
        raise HTTPException(status_code=401, detail="Unauthorized")

# ── SERVE PAGE ────────────────────────────────────────────────────────────────
@router.get("", response_class=HTMLResponse)
async def serve_admin_page():
    tpl = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "templates", "admin_whatsapp.html")
    )
    try:
        with open(tpl, "r") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found — ensure templates/admin_whatsapp.html is deployed")

# ── AUTH ──────────────────────────────────────────────────────────────────────
@router.post("/verify-password")
async def verify_password(request: Request):
    from app.core.redis_client import check_admin_rate_limit, create_admin_session

    # Brute-force protection — 5 attempts per 5 minutes per IP
    client_ip = request.client.host if request.client else "unknown"
    if not await check_admin_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many attempts — try again in 5 minutes")

    body = await request.json()
    cfg  = _cfg()

    if not cfg["admin_secret"]:
        raise HTTPException(status_code=500, detail="ADMIN_SECRET not set in Railway variables")

    if body.get("password", "") != cfg["admin_secret"]:
        return {"ok": False}

    token = secrets.token_urlsafe(32)
    await create_admin_session(token)
    logger.info("Admin session created from IP=%s", client_ip)
    return {"ok": True, "token": token}

# ── LIST CLIENTS ──────────────────────────────────────────────────────────────
@router.get("/clients")
async def list_clients(request: Request, db: AsyncSession = Depends(get_db)):
    await _require_admin(request)

    from app.models.client_model import Client
    from app.models.merchant import Merchant

    result = await db.execute(
        select(Client, Merchant)
        .join(Merchant, Client.merchant_id == Merchant.id)
        .order_by(Merchant.name, Client.name)
    )
    rows = result.all()

    return {
        "clients": [
            {
                "id":                   c.id,
                "store_name":           c.name,
                "merchant_name":        m.name,
                "merchant_id":          m.id,
                "merchant_email":       m.email,
                "whatsapp_number":      c.whatsapp_number or "",
                "operator_notify_phone": c.operator_notify_phone or "",
            }
            for c, m in rows
        ]
    }

# ── STEP 1: Add number to WABA ────────────────────────────────────────────────
@router.post("/add-number")
async def add_number(request: Request):
    await _require_admin(request)
    body  = await request.json()
    phone = str(body.get("phone", "")).strip()
    name  = str(body.get("display_name", "")).strip()
    cfg   = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info("AUDIT add_number — ip=%s phone=%s display_name=%s", client_ip, phone, name)

    if not phone or not name:
        raise HTTPException(status_code=400, detail="Phone number and display name are required")
    if not cfg["system_token"]:
        raise HTTPException(status_code=500, detail="META_SYSTEM_TOKEN not set in Railway variables")
    if not cfg["waba_id"]:
        raise HTTPException(status_code=500, detail="META_WABA_ID not set in Railway variables")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{GRAPH_URL}/{cfg['waba_id']}/phone_numbers",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={
                "cc":                   phone[:3] if len(phone) > 10 else "234",
                "phone_number":         phone,
                "display_name":         name,
                "migrate_phone_number": False,
            },
        )

    data = res.json()
    logger.info("Add number response: %s", data)

    if res.status_code not in (200, 201) or "id" not in data:
        detail = data.get("error", {}).get("message", str(data))
        raise HTTPException(status_code=400, detail=f"Meta error: {detail}")

    return {"phone_number_id": data["id"], "phone": phone}

# ── STEP 2: Request OTP ───────────────────────────────────────────────────────
@router.post("/request-otp")
async def request_otp(request: Request, db: AsyncSession = Depends(get_db)):
    await _require_admin(request)
    body            = await request.json()
    phone_number_id = str(body.get("phone_number_id", "")).strip()
    method          = str(body.get("method", "sms")).strip().upper()
    client_id       = str(body.get("client_id", "")).strip()
    cfg             = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        "AUDIT request_otp — ip=%s phone_number_id=%s client_id=%s method=%s",
        client_ip, phone_number_id, client_id or "—", method,
    )

    if not phone_number_id:
        raise HTTPException(status_code=400, detail="phone_number_id required")
    if method not in ("SMS", "VOICE"):
        method = "SMS"

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/request_code",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={"code_method": method, "language": "en_US"},
        )

    data = res.json()
    logger.info("Request OTP response: %s", data)

    if res.status_code != 200 or not data.get("success"):
        detail = data.get("error", {}).get("message", str(data))
        raise HTTPException(status_code=400, detail=f"Meta error: {detail}")

    # Fire OTP-requested email so merchant knows their number is being activated
    if client_id:
        try:
            from app.models.client_model import Client
            from app.models.merchant import Merchant
            client_res = await db.execute(
                select(Client, Merchant)
                .join(Merchant, Client.merchant_id == Merchant.id)
                .where(Client.id == client_id)
            )
            row = client_res.first()
            if row:
                cl, mer = row
                from app.services.email_service import send_otp_requested_email
                app_url = cfg.get("app_url", "").rstrip("/")
                from app.api.v1.workers.background_tasks import fire_and_forget
                fire_and_forget(send_otp_requested_email(
                    to_email=mer.email,
                    merchant_name=mer.name,
                    store_name=cl.name,
                    client_id=client_id,
                    whatsapp_number=cl.whatsapp_number or "",
                    store_dashboard_url=f"{app_url}/dashboard",
                ), name="send_otp_requested_email")
        except Exception as _e:
            logger.warning("OTP-requested email failed (non-fatal): %s", _e)

    return {"ok": True, "method": method}

# ── STEP 3: Verify OTP ───────────────────────────────────────────────────────
@router.post("/verify-otp")
async def verify_otp(request: Request):
    await _require_admin(request)
    body            = await request.json()
    phone_number_id = str(body.get("phone_number_id", "")).strip()
    code            = str(body.get("code", "")).strip()
    cfg             = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info("AUDIT verify_otp — ip=%s phone_number_id=%s", client_ip, phone_number_id)

    if not phone_number_id or not code:
        raise HTTPException(status_code=400, detail="phone_number_id and code required")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/verify_code",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={"code": code},
        )

    data = res.json()
    logger.info("Verify OTP response: %s", data)

    if res.status_code != 200 or not data.get("success"):
        detail = data.get("error", {}).get("message", str(data))
        raise HTTPException(status_code=400, detail=f"Meta error: {detail}")

    return {"ok": True}

# ── STEP 4: Register on Cloud API + Subscribe webhook ─────────────────────────
@router.post("/activate")
async def activate(request: Request):
    await _require_admin(request)
    body            = await request.json()
    phone_number_id = str(body.get("phone_number_id", "")).strip()
    cfg             = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info("AUDIT activate — ip=%s phone_number_id=%s", client_ip, phone_number_id)

    if not phone_number_id:
        raise HTTPException(status_code=400, detail="phone_number_id required")

    async with httpx.AsyncClient(timeout=30) as client:

        # Register on Cloud API
        reg_res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/register",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={"messaging_product": "whatsapp", "pin": "000000"},
        )
        reg_data = reg_res.json()
        logger.info("Register response: %s", reg_data)

        if reg_res.status_code != 200 or not reg_data.get("success"):
            detail = reg_data.get("error", {}).get("message", str(reg_data))
            raise HTTPException(status_code=400, detail=f"Registration failed: {detail}")

        # Subscribe webhook
        sub_res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/subscribed_apps",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
        )
        sub_data = sub_res.json()
        logger.info("Subscribe webhook response: %s", sub_data)

        if sub_res.status_code != 200 or not sub_data.get("success"):
            detail = sub_data.get("error", {}).get("message", str(sub_data))
            logger.warning("Webhook subscription warning (non-fatal): %s", detail)

    return {"ok": True}

# ── STEP 5: Save to Ordaa DB ──────────────────────────────────────────────────
@router.post("/save")
async def save_to_db(request: Request, db: AsyncSession = Depends(get_db)):
    await _require_admin(request)
    body            = await request.json()
    client_id       = str(body.get("client_id", "")).strip()
    phone_number_id = str(body.get("phone_number_id", "")).strip()
    whatsapp_number = str(body.get("whatsapp_number", "")).strip()
    client_ip = request.client.host if request.client else "unknown"
    logger.info(
        "AUDIT save_to_db — ip=%s client_id=%s phone_number_id=%s whatsapp_number=%s",
        client_ip, client_id, phone_number_id, whatsapp_number,
    )

    if not client_id or not phone_number_id:
        raise HTTPException(status_code=400, detail="client_id and phone_number_id required")

    from app.models.client_model import Client
    from app.models.client_whatsapp_credential import ClientWhatsAppCredential

    client_res = await db.execute(select(Client).where(Client.id == client_id))
    client     = client_res.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Store not found")

    dup = await db.execute(
        select(ClientWhatsAppCredential).where(
            ClientWhatsAppCredential.phone_number_id == phone_number_id
        )
    )
    existing = dup.scalar_one_or_none()

    if existing:
        if existing.client_id == client_id:
            existing.whatsapp_number = whatsapp_number
            existing.active          = True
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Phone Number ID already assigned to store {existing.client_id}"
            )
    else:
        db.add(ClientWhatsAppCredential(
            client_id=client_id,
            phone_number_id=phone_number_id,
            whatsapp_number=whatsapp_number,
            active=True,
        ))

    client.whatsapp_number = whatsapp_number
    await db.commit()

    logger.info("WhatsApp credential saved — client=%s phone_number_id=%s", client_id, phone_number_id)

    # Mark waba_active on merchant
    from app.models.merchant import Merchant
    merchant_res = await db.execute(select(Merchant).where(Merchant.id == client.merchant_id))
    merchant     = merchant_res.scalar_one_or_none()
    if merchant:
        merchant.waba_active = True
        await db.commit()

    # Send "you're live" email to merchant
    try:
        from app.services.email_service import send_store_live_email
        if merchant:
            _app_url = os.getenv("APP_URL", "https://shopprhq.app")
            from app.api.v1.workers.background_tasks import fire_and_forget
            fire_and_forget(send_store_live_email(
                to_email=merchant.email,
                merchant_name=merchant.name,
                store_name=client.name,
                client_id=client_id,
                whatsapp_number=whatsapp_number,
                store_dashboard_url=f"{_app_url}/dashboard",
            ), name="send_store_live_email")
    except Exception as _e:
        logger.warning("store-live email failed (non-fatal): %s", _e)

    # Slack alert
    try:
        from app.infrastructure.alerting.slack import alert
        from app.api.v1.workers.background_tasks import fire_and_forget
        fire_and_forget(alert(
            title="Store Live on WhatsApp ✅",
            detail=f"*{client.name}* is now connected to WhatsApp and live.",
            level="info",
            fields={
                "Store ID":        client_id,
                "Merchant":        merchant.name if merchant else "—",
                "Phone Number":    "+" + whatsapp_number if whatsapp_number else "—",
                "Phone Number ID": phone_number_id,
            },
        ))
    except Exception:
        pass

    return {"ok": True, "client_id": client_id, "phone_number_id": phone_number_id}
