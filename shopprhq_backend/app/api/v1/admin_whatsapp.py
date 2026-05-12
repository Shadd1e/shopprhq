# app/api/v1/admin_whatsapp.py
"""
Internal admin tool — WhatsApp number onboarding.
Protected by ADMIN_SECRET env var (Redis-backed session, 4 h expiry).
Accessible at /admin/whatsapp-setup

Merchant-facing self-serve OTP endpoints live at the bottom of this file
and are protected by the normal merchant JWT, not the admin secret.
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

# ── Onboarding status constants ───────────────────────────────────────────────
# Stored on Client.onboarding_status so both admin and merchant
# dashboards always reflect the real state.

STATUS_PENDING          = "pending"           # registered, number not yet added to WABA
STATUS_ADDED_TO_WABA    = "added_to_waba"     # admin added number, awaiting OTP request
STATUS_OTP_REQUESTED    = "otp_requested"     # OTP sent to merchant's phone — waiting for code
STATUS_OTP_SUBMITTED    = "otp_submitted"     # merchant submitted code — waiting for admin to verify
STATUS_OTP_FAILED       = "otp_failed"        # wrong code — merchant can retry
STATUS_NUMBER_IN_USE    = "number_in_use"     # Meta: number already on another Business account
STATUS_NUMBER_PERSONAL  = "number_personal"   # Meta: number active on personal WhatsApp
STATUS_NUMBER_INVALID   = "number_invalid"    # Meta: number format rejected
STATUS_ACTIVE           = "active"            # fully onboarded and live

# ── Meta error code → clean status mapping ───────────────────────────────────
_META_ERROR_STATUS = {
    2388023: STATUS_NUMBER_IN_USE,
    2388094: STATUS_NUMBER_IN_USE,
    2388055: STATUS_NUMBER_PERSONAL,
    100:     STATUS_NUMBER_INVALID,
}

_META_ERROR_MESSAGE = {
    STATUS_NUMBER_IN_USE:   "This number is already registered on WhatsApp Business. Please contact support.",
    STATUS_NUMBER_PERSONAL: "This number is currently active on personal WhatsApp. The merchant must delete their WhatsApp account on this number first, then contact support to retry.",
    STATUS_NUMBER_INVALID:  "This doesn't look like a valid phone number. The merchant needs to update it.",
}

def _parse_meta_error(data: dict) -> tuple[int, str]:
    """Return (meta_error_code, message) from a failed Meta response."""
    err  = data.get("error", {})
    code = err.get("code", 0)
    msg  = err.get("message", str(data))
    return code, msg


# ── CONFIG — all read from env, never sent to browser ────────────────────────
def _cfg():
    return {
        "admin_secret": os.getenv("ADMIN_SECRET", ""),
        "system_token": os.getenv("META_SYSTEM_TOKEN", ""),
        "waba_id":      os.getenv("META_WABA_ID", ""),
        "app_url":      os.getenv("APP_URL", ""),
        "verify_token": os.getenv("META_VERIFY_TOKEN", ""),
    }


# ── Session guard ─────────────────────────────────────────────────────────────
async def _require_admin(request: Request):
    from app.core.redis_client import validate_admin_session
    token = request.headers.get("X-Admin-Token", "")
    if not token or not await validate_admin_session(token):
        raise HTTPException(status_code=401, detail="Unauthorized")


# ── Serve admin HTML page ─────────────────────────────────────────────────────
@router.get("", response_class=HTMLResponse)
async def serve_admin_page():
    tpl = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "templates", "admin_whatsapp.html")
    )
    try:
        with open(tpl) as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Template not found")


# ── AUTH ──────────────────────────────────────────────────────────────────────
@router.post("/verify-password")
async def verify_password(request: Request):
    from app.core.redis_client import check_admin_rate_limit, create_admin_session

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
                "id":                    c.id,
                "store_name":            c.name,
                "merchant_name":         m.name,
                "merchant_id":           m.id,
                "merchant_email":        m.email,
                "whatsapp_number":       c.whatsapp_number or "",
                "operator_notify_phone": c.operator_notify_phone or "",
                "onboarding_status":     getattr(c, "onboarding_status", STATUS_PENDING),
                "pending_otp_code":      getattr(c, "pending_otp_code", None),
            }
            for c, m in rows
        ]
    }


# ── STEP 1: Add number to WABA ────────────────────────────────────────────────
@router.post("/add-number")
async def add_number(request: Request, db: AsyncSession = Depends(get_db)):
    await _require_admin(request)
    body      = await request.json()
    phone     = str(body.get("phone", "")).strip()
    name      = str(body.get("display_name", "")).strip()
    client_id = str(body.get("client_id", "")).strip()
    cfg       = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info("AUDIT add_number — ip=%s phone=%s display_name=%s client_id=%s", client_ip, phone, name, client_id)

    if not phone or not name:
        raise HTTPException(status_code=400, detail="Phone number and display name are required")
    if not cfg["system_token"]:
        raise HTTPException(status_code=500, detail="META_SYSTEM_TOKEN not set")
    if not cfg["waba_id"]:
        raise HTTPException(status_code=500, detail="META_WABA_ID not set")

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
        meta_code, meta_msg = _parse_meta_error(data)
        mapped_status = _META_ERROR_STATUS.get(meta_code)

        # Update the client's onboarding_status so merchant dashboard reflects it
        if client_id and mapped_status:
            await _set_client_status(db, client_id, mapped_status)

        clean_msg = _META_ERROR_MESSAGE.get(mapped_status, f"Meta error: {meta_msg}")
        raise HTTPException(status_code=400, detail=clean_msg)

    # Success — mark as added to WABA
    if client_id:
        await _set_client_status(db, client_id, STATUS_ADDED_TO_WABA)

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
        meta_code, meta_msg = _parse_meta_error(data)
        mapped_status = _META_ERROR_STATUS.get(meta_code)
        if client_id and mapped_status:
            await _set_client_status(db, client_id, mapped_status)
        clean_msg = _META_ERROR_MESSAGE.get(mapped_status, f"Meta error: {meta_msg}")
        raise HTTPException(status_code=400, detail=clean_msg)

    # Mark OTP as requested — this is also what unlocks the OTP input on merchant dashboard
    if client_id:
        await _set_client_status(db, client_id, STATUS_OTP_REQUESTED)

    # Email merchant — they now know to check their phone
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
                from app.api.v1.workers.background_tasks import fire_and_forget
                app_url = cfg.get("app_url", "").rstrip("/")
                fire_and_forget(
                    send_otp_requested_email(
                        to_email=mer.email,
                        merchant_name=mer.name,
                        store_name=cl.name,
                        client_id=client_id,
                        whatsapp_number=cl.whatsapp_number or "",
                        store_dashboard_url=f"{app_url}/dashboard",
                    ),
                    name="send_otp_requested_email",
                )
        except Exception as e:
            logger.warning("OTP-requested email failed (non-fatal): %s", e)

    return {"ok": True, "method": method}


# ── STEP 3: Verify OTP ────────────────────────────────────────────────────────
@router.post("/verify-otp")
async def verify_otp(request: Request, db: AsyncSession = Depends(get_db)):
    await _require_admin(request)
    body            = await request.json()
    phone_number_id = str(body.get("phone_number_id", "")).strip()
    client_id       = str(body.get("client_id", "")).strip()
    cfg             = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info("AUDIT verify_otp — ip=%s phone_number_id=%s client_id=%s", client_ip, phone_number_id, client_id)

    if not phone_number_id:
        raise HTTPException(status_code=400, detail="phone_number_id required")

    # If client_id provided, read the code the merchant submitted
    code = str(body.get("code", "")).strip()
    if not code and client_id:
        from app.models.client_model import Client
        res = await db.execute(select(Client).where(Client.id == client_id))
        cl  = res.scalar_one_or_none()
        if cl and getattr(cl, "pending_otp_code", None):
            code = cl.pending_otp_code

    if not code:
        raise HTTPException(status_code=400, detail="No OTP code available — merchant has not submitted one yet")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/verify_code",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={"code": code},
        )

    data = res.json()
    logger.info("Verify OTP response: %s", data)

    if res.status_code != 200 or not data.get("success"):
        _, meta_msg = _parse_meta_error(data)
        if client_id:
            await _set_client_status(db, client_id, STATUS_OTP_FAILED)
            # Clear the bad code so merchant can re-submit
            await _clear_pending_otp(db, client_id)
        raise HTTPException(status_code=400, detail=f"Code incorrect or expired: {meta_msg}")

    # Clear stored code after successful verification
    if client_id:
        await _clear_pending_otp(db, client_id)

    return {"ok": True}


# ── STEP 4: Activate ──────────────────────────────────────────────────────────
@router.post("/activate")
async def activate(request: Request, db: AsyncSession = Depends(get_db)):
    await _require_admin(request)
    body            = await request.json()
    phone_number_id = str(body.get("phone_number_id", "")).strip()
    client_id       = str(body.get("client_id", "")).strip()
    cfg             = _cfg()
    client_ip = request.client.host if request.client else "unknown"
    logger.info("AUDIT activate — ip=%s phone_number_id=%s", client_ip, phone_number_id)

    if not phone_number_id:
        raise HTTPException(status_code=400, detail="phone_number_id required")

    # Generate a real random PIN instead of the hardcoded "000000"
    registration_pin = secrets.token_hex(3)  # 6 hex chars = 6 digits

    async with httpx.AsyncClient(timeout=30) as client:

        # Register on Cloud API
        reg_res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/register",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={"messaging_product": "whatsapp", "pin": registration_pin},
        )
        reg_data = reg_res.json()
        logger.info("Register response: %s", reg_data)

        if reg_res.status_code != 200 or not reg_data.get("success"):
            _, meta_msg = _parse_meta_error(reg_data)
            raise HTTPException(status_code=400, detail=f"Registration failed: {meta_msg}")

        # Subscribe webhook
        sub_res = await client.post(
            f"{GRAPH_URL}/{phone_number_id}/subscribed_apps",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
        )
        sub_data = sub_res.json()
        logger.info("Subscribe webhook response: %s", sub_data)

        if sub_res.status_code != 200 or not sub_data.get("success"):
            _, sub_msg = _parse_meta_error(sub_data)
            logger.warning("Webhook subscription warning (non-fatal): %s", sub_msg)

    return {"ok": True, "registration_pin": registration_pin}


# ── STEP 5: Save to DB + notify merchant ─────────────────────────────────────
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
    cl = client_res.scalar_one_or_none()
    if not cl:
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
                detail=f"Phone Number ID already assigned to store {existing.client_id}",
            )
    else:
        db.add(ClientWhatsAppCredential(
            client_id=client_id,
            phone_number_id=phone_number_id,
            whatsapp_number=whatsapp_number,
            active=True,
        ))

    cl.whatsapp_number   = whatsapp_number
    cl.onboarding_status = STATUS_ACTIVE  # permanently locks number editing
    await db.commit()

    logger.info("WhatsApp credential saved — client=%s phone_number_id=%s", client_id, phone_number_id)

    # Mark waba_active on merchant
    from app.models.merchant import Merchant
    merchant_res = await db.execute(select(Merchant).where(Merchant.id == cl.merchant_id))
    merchant = merchant_res.scalar_one_or_none()
    if merchant:
        merchant.waba_active = True
        await db.commit()

    # "You're live" email
    try:
        if merchant:
            from app.services.email_service import send_store_live_email
            from app.api.v1.workers.background_tasks import fire_and_forget
            _app_url = os.getenv("APP_URL", "https://shopprhq.app")
            fire_and_forget(
                send_store_live_email(
                    to_email=merchant.email,
                    merchant_name=merchant.name,
                    store_name=cl.name,
                    client_id=client_id,
                    whatsapp_number=whatsapp_number,
                    store_dashboard_url=f"{_app_url}/dashboard",
                ),
                name="send_store_live_email",
            )
    except Exception as e:
        logger.warning("store-live email failed (non-fatal): %s", e)

    # Slack alert
    try:
        from app.infrastructure.alerting.slack import alert
        from app.api.v1.workers.background_tasks import fire_and_forget
        fire_and_forget(
            alert(
                title="Store Live on WhatsApp ✅",
                detail=f"*{cl.name}* is now connected to WhatsApp and live.",
                level="info",
                fields={
                    "Store ID":        client_id,
                    "Merchant":        merchant.name if merchant else "—",
                    "Phone Number":    "+" + whatsapp_number if whatsapp_number else "—",
                    "Phone Number ID": phone_number_id,
                },
            )
        )
    except Exception:
        pass

    return {"ok": True, "client_id": client_id, "phone_number_id": phone_number_id}


# =============================================================================
# MERCHANT-FACING SELF-SERVE OTP ENDPOINTS
# Protected by normal merchant JWT — admin secret never involved
# =============================================================================

merchant_router = APIRouter(
    prefix="/api/v1/merchants",
    tags=["Merchant — WhatsApp Onboarding"],
)


@merchant_router.patch("/whatsapp-number")
async def update_whatsapp_number(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Merchant can update their WhatsApp number only while onboarding_status
    is pending, added_to_waba, otp_failed, or number_* error states.
    Once OTP is requested or store is active the number is locked.
    """
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    body  = await request.json()
    phone = str(body.get("whatsapp_number", "")).strip().lstrip("+")

    if not phone or not phone.isdigit() or not (7 <= len(phone) <= 15):
        raise HTTPException(status_code=400, detail="Enter a valid phone number with country code, digits only.")

    from app.models.client_model import Client

    # Find the merchant's store
    res = await db.execute(
        select(Client).where(Client.merchant_id == merchant_id)
    )
    cl = res.scalars().first()
    if not cl:
        raise HTTPException(status_code=404, detail="Store not found")

    locked_statuses = {STATUS_OTP_REQUESTED, STATUS_OTP_SUBMITTED, STATUS_ACTIVE}
    current_status  = getattr(cl, "onboarding_status", STATUS_PENDING)

    if current_status in locked_statuses:
        raise HTTPException(
            status_code=403,
            detail="Your number is locked and can no longer be changed. Contact support if you need help.",
        )

    cl.whatsapp_number   = phone
    cl.onboarding_status = STATUS_PENDING  # reset so admin sees it as needing a fresh start
    await db.commit()

    return {"ok": True, "whatsapp_number": phone}


@merchant_router.post("/request-otp")
async def merchant_request_otp(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Merchant triggers OTP to their phone themselves.
    Backend reads phone_number_id from DB and calls Meta using system token
    from Railway — no secrets are ever sent to the browser.

    Only works once admin has completed Step 1 (add-number) for this store
    i.e. onboarding_status == added_to_waba or otp_failed.
    """
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    body   = await request.json()
    method = str(body.get("method", "sms")).strip().upper()
    if method not in ("SMS", "VOICE"):
        method = "SMS"

    from app.models.client_model import Client
    from app.models.client_whatsapp_credential import ClientWhatsAppCredential

    res = await db.execute(select(Client).where(Client.merchant_id == merchant_id))
    cl  = res.scalars().first()
    if not cl:
        raise HTTPException(status_code=404, detail="Store not found")

    current_status = getattr(cl, "onboarding_status", STATUS_PENDING)
    allowed = {STATUS_ADDED_TO_WABA, STATUS_OTP_FAILED, STATUS_NUMBER_PERSONAL}

    if current_status not in allowed:
        if current_status == STATUS_PENDING:
            raise HTTPException(
                status_code=403,
                detail="Your number hasn't been added to our system yet. You'll receive an email when you can proceed.",
            )
        if current_status == STATUS_OTP_REQUESTED:
            raise HTTPException(
                status_code=403,
                detail="A code has already been sent to your phone. Enter it below.",
            )
        if current_status == STATUS_ACTIVE:
            raise HTTPException(status_code=403, detail="Your store is already live.")
        raise HTTPException(status_code=403, detail="Unable to request code at this stage. Contact support.")

    # Fetch the phone_number_id Meta assigned to this store
    cred_res = await db.execute(
        select(ClientWhatsAppCredential).where(
            ClientWhatsAppCredential.client_id == cl.id,
            ClientWhatsAppCredential.active == True,  # noqa: E712
        )
    )
    cred = cred_res.scalars().first()
    if not cred or not cred.phone_number_id:
        raise HTTPException(
            status_code=400,
            detail="Your number hasn't been fully added yet. You'll be notified when you can proceed.",
        )

    cfg = _cfg()
    async with httpx.AsyncClient(timeout=30) as client:
        meta_res = await client.post(
            f"{GRAPH_URL}/{cred.phone_number_id}/request_code",
            headers={"Authorization": f"Bearer {cfg['system_token']}"},
            json={"code_method": method, "language": "en_US"},
        )

    data = meta_res.json()
    logger.info("Merchant request_otp response for client=%s: %s", cl.id, data)

    if meta_res.status_code != 200 or not data.get("success"):
        meta_code, meta_msg = _parse_meta_error(data)
        mapped_status = _META_ERROR_STATUS.get(meta_code)
        if mapped_status:
            cl.onboarding_status = mapped_status
            await db.commit()
        clean_msg = _META_ERROR_MESSAGE.get(mapped_status, f"Could not send code: {meta_msg}")
        raise HTTPException(status_code=400, detail=clean_msg)

    cl.onboarding_status = STATUS_OTP_REQUESTED
    await db.commit()

    return {"ok": True, "method": method}


@merchant_router.post("/submit-otp")
async def merchant_submit_otp(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Merchant submits the 6-digit code Meta sent to their phone.
    Code is stored against the store and status set to otp_submitted.
    Admin sees it on their panel and proceeds with verify + activate + save.
    """
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    body = await request.json()
    code = str(body.get("code", "")).strip()

    if not code or not code.isdigit() or len(code) != 6:
        raise HTTPException(status_code=400, detail="Enter the 6-digit code from your phone.")

    from app.models.client_model import Client

    res = await db.execute(select(Client).where(Client.merchant_id == merchant_id))
    cl  = res.scalars().first()
    if not cl:
        raise HTTPException(status_code=404, detail="Store not found")

    if getattr(cl, "onboarding_status", None) != STATUS_OTP_REQUESTED:
        raise HTTPException(
            status_code=403,
            detail="No code was requested or your store is already active.",
        )

    cl.pending_otp_code  = code
    cl.onboarding_status = STATUS_OTP_SUBMITTED
    await db.commit()

    logger.info("Merchant submitted OTP for client=%s", cl.id)

    # Notify admin via Slack so they know to proceed
    try:
        from app.infrastructure.alerting.slack import alert
        from app.api.v1.workers.background_tasks import fire_and_forget
        fire_and_forget(
            alert(
                title="OTP Submitted — Action Required 🔑",
                detail=f"*{cl.name}* has submitted their WhatsApp verification code. Ready to verify + activate.",
                level="warning",
                fields={
                    "Store ID":    cl.id,
                    "Store Name":  cl.name,
                    "Next Step":   "Admin panel → verify OTP → activate → save",
                },
            )
        )
    except Exception:
        pass

    return {
        "ok": True,
        "message": "Code received. We'll complete your setup shortly and notify you by email once your store is live.",
    }


# ── Helper: update onboarding status ─────────────────────────────────────────
async def _set_client_status(db: AsyncSession, client_id: str, status: str):
    from app.models.client_model import Client
    res = await db.execute(select(Client).where(Client.id == client_id))
    cl  = res.scalar_one_or_none()
    if cl:
        cl.onboarding_status = status
        await db.commit()


async def _clear_pending_otp(db: AsyncSession, client_id: str):
    from app.models.client_model import Client
    res = await db.execute(select(Client).where(Client.id == client_id))
    cl  = res.scalar_one_or_none()
    if cl:
        cl.pending_otp_code = None
        await db.commit()
