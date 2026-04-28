import logging
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.schemas.merchant import MerchantCreate, MerchantRead, MerchantUpdate, MerchantLogin
from app.services.merchant_service import MerchantService
from app.db.deps import get_db

router = APIRouter(prefix="/merchants", tags=["Merchants"])


def _require_merchant(request: Request) -> str:
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return merchant_id


# ─────────────────────────────────────────────────────────────────────────────
# REGISTER  (public)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", response_model=MerchantRead, status_code=201)
async def create_merchant(payload: MerchantCreate, db: AsyncSession = Depends(get_db)):
    service = MerchantService(db)
    try:
        merchant = await service.create(payload)
        if not merchant:
            raise HTTPException(status_code=400, detail="An account with this email already exists")

        await db.commit()
        await db.refresh(merchant)

        client_id = getattr(merchant, "_auto_client_id", None)

        # ── Verification email ─────────────────────────────────────────────
        # Includes the WhatsApp number so the merchant sees it was captured.
        try:
            from app.services.email_service import send_verification_email
            from app.api.v1.workers.background_tasks import fire_and_forget
            fire_and_forget(send_verification_email(
                to_email=merchant.email,
                merchant_name=merchant.name,
                merchant_id=merchant.id,
                client_id=client_id,
                token=merchant.email_verification_token,
                whatsapp_number=merchant.whatsapp_number,
            ), name="send_verification_email")
        except Exception as e:
            logger.warning("Failed to schedule verification email: %s", e)

        # ── Slack alert — new merchant registered ──────────────────────────
        # Includes the submitted WhatsApp number so you can start onboarding.
        try:
            from app.infrastructure.alerting.slack import alert
            from app.api.v1.workers.background_tasks import fire_and_forget
            fire_and_forget(alert(
                title="New Merchant Registered",
                detail=f"*{merchant.name}* just signed up on ShopprHQ.",
                level="info",
                fields={
                    "Merchant ID":    merchant.id,
                    "Email":          merchant.email,
                    "Store ID":       client_id or "—",
                    "WhatsApp Number": f"+{merchant.whatsapp_number}" if merchant.whatsapp_number else "Not submitted",
                },
            ), name="slack_new_merchant")
        except Exception:
            pass

        return merchant

    except HTTPException:
        raise
    except IntegrityError:
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    except Exception as e:
        logger.exception("Merchant registration failed")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")


# ─────────────────────────────────────────────────────────────────────────────
# VERIFY EMAIL CODE  (auth required)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/verify-email-code")
async def verify_email_code(request: Request, db: AsyncSession = Depends(get_db)):
    merchant_id = _require_merchant(request)
    body        = await request.json()
    code        = str(body.get("code", "")).strip()

    if not code or len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Enter the 6-digit code from your email.")

    service = MerchantService(db)
    success, reason = await service.verify_email_code(merchant_id, code)

    if not success:
        raise HTTPException(status_code=400, detail=reason)

    await db.commit()

    # ── Welcome email — fires after successful verification ────────────────
    try:
        merchant = await service.get(merchant_id)
        if merchant:
            from app.services.email_service import send_welcome_email
            from app.api.v1.workers.background_tasks import fire_and_forget
            fire_and_forget(send_welcome_email(
                to_email=merchant.email,
                merchant_name=merchant.name,
                merchant_id=merchant.id,
            ), name="send_welcome_email")
    except Exception:
        pass

    if reason == "already_verified":
        return {"detail": "already_verified"}
    return {"detail": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# GET OWN PROFILE  (auth required — own merchant only)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(request: Request, db: AsyncSession = Depends(get_db)):
    merchant_id = _require_merchant(request)
    service     = MerchantService(db)
    merchant    = await service.get(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return {
        "id":               merchant.id,
        "name":             merchant.name,
        "email":            merchant.email,
        "email_verified":   merchant.email_verified,
        "whatsapp_number":  merchant.whatsapp_number,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET BY ID  (auth required — own merchant only)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{merchant_id}", response_model=MerchantRead)
async def get_merchant(merchant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    authed = _require_merchant(request)
    if merchant_id != authed:
        raise HTTPException(status_code=403, detail="Access denied")
    service  = MerchantService(db)
    merchant = await service.get(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return merchant


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE  (auth required — own merchant only)
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{merchant_id}", response_model=MerchantRead)
async def update_merchant(
    merchant_id: str, payload: MerchantUpdate, request: Request, db: AsyncSession = Depends(get_db)
):
    authed = _require_merchant(request)
    if merchant_id != authed:
        raise HTTPException(status_code=403, detail="Access denied")
    service = MerchantService(db)
    try:
        merchant = await service.update(merchant_id, payload.model_dump(exclude_unset=True))
        if not merchant:
            raise HTTPException(status_code=404, detail="Merchant not found")
        return merchant
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Failed to update merchant")


# ─────────────────────────────────────────────────────────────────────────────
# DELETE  (auth required — own merchant only)
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{merchant_id}", response_model=dict)
async def delete_merchant(merchant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    authed = _require_merchant(request)
    if merchant_id != authed:
        raise HTTPException(status_code=403, detail="Access denied")
    service = MerchantService(db)
    success = await service.delete(merchant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Merchant not found")
    return {"detail": "Deleted successfully"}


# ─────────────────────────────────────────────────────────────────────────────
# LOGIN  (public)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login_merchant(payload: MerchantLogin, db: AsyncSession = Depends(get_db)):
    from app.core.security import create_access_token
    service  = MerchantService(db)
    merchant = await service.authenticate(payload.merchant_id, payload.password)
    if not merchant:
        raise HTTPException(status_code=401, detail="Invalid credentials or account locked")
    token          = create_access_token(subject=merchant.id)
    email_verified = getattr(merchant, "email_verified", False) or False
    return {
        "access_token":   token,
        "token_type":     "bearer",
        "merchant_id":    merchant.id,
        "name":           merchant.name,
        "email":          merchant.email,
        "email_verified": email_verified,
    }


# ─────────────────────────────────────────────────────────────────────────────
# FORGOT PASSWORD  (public — step 1: request a reset code)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/forgot-password")
async def forgot_password(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Sends a 6-digit password reset code to the merchant's registered email.
    Always returns 200 regardless of whether the email exists (no enumeration).
    Code is stored in Redis with a 10-minute TTL.
    """
    body  = await request.json()
    email = (body.get("email") or "").strip().lower()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")

    service  = MerchantService(db)
    from sqlalchemy import select as _sel
    from app.models.merchant import Merchant as _M

    # Look up merchant by email — silently succeed even if not found
    res      = await db.execute(_sel(_M).where(_M.email == email))
    merchant = res.scalar_one_or_none()

    if merchant:
        import random
        code = f"{random.randint(100000, 999999)}"

        # Store in Redis: key = pwd_reset:{email}, value = code, TTL = 10 min
        try:
            from app.core.redis_client import redis_service
            r = await redis_service.get_client()
            await r.setex(f"pwd_reset:{email}", 600, code)
        except Exception as e:
            logger.warning("Redis unavailable for pwd reset code: %s", e)
            raise HTTPException(status_code=503, detail="Service temporarily unavailable. Try again shortly.")

        try:
            from app.services.email_service import send_password_reset_email
            from app.api.v1.workers.background_tasks import fire_and_forget
            fire_and_forget(send_password_reset_email(
                to_email=email,
                merchant_name=merchant.name,
                code=code,
            ), name="send_password_reset_email")
        except Exception as e:
            logger.warning("Password reset email failed (non-fatal): %s", e)

    return {"detail": "If that email is registered, a reset code has been sent."}


# ─────────────────────────────────────────────────────────────────────────────
# RESET PASSWORD  (public — step 2: verify code + set new password)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Verifies the 6-digit code sent to the merchant's email and updates
    their password. Code is consumed on first successful use.
    """
    body         = await request.json()
    email        = (body.get("email") or "").strip().lower()
    code         = str(body.get("code") or "").strip()
    new_password = str(body.get("new_password") or "").strip()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if not code or len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Enter the 6-digit code from your email.")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    # Verify code from Redis
    try:
        from app.core.redis_client import redis_service
        r        = await redis_service.get_client()
        key      = f"pwd_reset:{email}"
        stored   = await r.get(key)
    except Exception as e:
        logger.warning("Redis unavailable for pwd reset verify: %s", e)
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Try again shortly.")

    if not stored or stored != code:
        raise HTTPException(status_code=400, detail="Incorrect or expired code. Request a new one.")

    # Find merchant and update password
    from sqlalchemy import select as _sel
    from app.models.merchant import Merchant as _M
    from app.core.security import get_password_hash

    res      = await db.execute(_sel(_M).where(_M.email == email))
    merchant = res.scalar_one_or_none()

    if not merchant:
        raise HTTPException(status_code=400, detail="Incorrect or expired code. Request a new one.")

    merchant.password_hash    = get_password_hash(new_password)
    merchant.failed_attempts  = 0   # clear any lockout
    await db.commit()

    # Consume the code so it cannot be reused
    try:
        await r.delete(key)
    except Exception:
        pass

    return {"detail": "Password updated. You can now sign in with your new password."}


# ─────────────────────────────────────────────────────────────────────────────
# RESEND VERIFICATION  (auth required)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/resend-verification")
async def resend_verification(request: Request, db: AsyncSession = Depends(get_db)):
    merchant_id = _require_merchant(request)
    service     = MerchantService(db)
    merchant    = await service.get(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if merchant.email_verified:
        return {"detail": "Email already verified"}

    new_code = await service.refresh_verification_code(merchant_id)
    if not new_code:
        raise HTTPException(status_code=400, detail="Could not generate code")
    await db.commit()
    await db.refresh(merchant)

    try:
        from app.services.email_service import send_verification_email
        from app.api.v1.workers.background_tasks import fire_and_forget
        fire_and_forget(send_verification_email(
            to_email=merchant.email,
            merchant_name=merchant.name,
            merchant_id=merchant.id,
            token=new_code,
            whatsapp_number=merchant.whatsapp_number,
        ), name="send_resend_verification_email")
    except Exception as e:
        logger.warning("Resend verification email failed: %s", e)

    return {"detail": "Verification code sent"}


# ─────────────────────────────────────────────────────────────────────────────
# CHANGE EMAIL  (auth required — before verification only)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/change-email")
async def change_email(request: Request, db: AsyncSession = Depends(get_db)):
    merchant_id = _require_merchant(request)
    body        = await request.json()
    new_email   = body.get("email", "").strip().lower()

    if not new_email or "@" not in new_email:
        raise HTTPException(status_code=400, detail="Valid email address required")

    service  = MerchantService(db)
    merchant = await service.get(merchant_id)
    if not merchant:
        raise HTTPException(status_code=404, detail="Merchant not found")
    if merchant.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified and cannot be changed")

    from sqlalchemy import select as sa_select
    from app.models.merchant import Merchant as MerchantModel
    existing = await db.execute(
        sa_select(MerchantModel).where(
            MerchantModel.email == new_email,
            MerchantModel.id    != merchant_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="That email is already in use")

    merchant.email          = new_email
    merchant.email_verified = False
    new_code = await service.refresh_verification_code(merchant_id)
    await db.commit()
    await db.refresh(merchant)

    try:
        from app.services.email_service import send_verification_email
        from app.api.v1.workers.background_tasks import fire_and_forget
        fire_and_forget(send_verification_email(
            to_email=merchant.email,
            merchant_name=merchant.name,
            merchant_id=merchant.id,
            token=new_code or merchant.email_verification_token,
            whatsapp_number=merchant.whatsapp_number,
        ), name="send_change_email_verification")
    except Exception as e:
        logger.warning("Change email send failed: %s", e)

    return {"detail": "Email updated and verification sent", "email": new_email}
