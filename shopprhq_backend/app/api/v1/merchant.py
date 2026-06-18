import logging
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.schemas.merchant import MerchantCreate, MerchantRead, MerchantUpdate, MerchantLogin, MerchantApply
from app.services.merchant_service import MerchantService
from app.db.deps import get_db

router = APIRouter(prefix="/merchants", tags=["Merchants"])


async def _generate_application_id(db: AsyncSession) -> str:
    """Generate a random Application ID e.g. APA3F7K2 (mirrors the MX/ST scheme
    used for merchants/stores in MerchantService)."""
    import secrets
    import string
    from app.models.merchant_application import MerchantApplication

    alphabet = string.ascii_uppercase + string.digits
    for _ in range(20):
        candidate = "AP" + "".join(secrets.choice(alphabet) for _ in range(6))
        exists = await db.execute(
            select(MerchantApplication.id).where(MerchantApplication.id == candidate)
        )
        if not exists.scalar_one_or_none():
            return candidate
    raise RuntimeError("Failed to generate unique application ID after 20 attempts")


def _generate_link_token() -> str:
    """
    Generate the public, unguessable token used by the "add my WhatsApp
    number" page link. Deliberately separate from the short application ID
    (which shows up in Slack/admin UI) — this token is a bearer credential
    for an unauthenticated public page, so it needs real entropy. 24 random
    bytes (192 bits) makes brute-forcing it computationally meaningless, so
    no DB-uniqueness retry loop is needed the way it is for the short ID.
    """
    import secrets
    return secrets.token_urlsafe(24)


_OPEN_APPLICATION_STATUSES = ("pending", "needs_attention")


def _require_merchant(request: Request) -> str:
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return merchant_id


# ─────────────────────────────────────────────────────────────────────────────
# REGISTER  (DISABLED — public self-registration is no longer available)
# Merchants must apply via POST /merchants/apply and be approved by an admin.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/", status_code=410)
async def create_merchant_disabled():
    raise HTTPException(
        status_code=410,
        detail=(
            "Self-registration is no longer available. "
            "Please apply at shopprhq.com — our team will review and create your account."
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
# APPLY  (public)
# Accepts the "Apply to Use" form, saves it so admin can review it on the
# WhatsApp-setup dashboard, and sends ONE email to the applicant. No
# Merchant/Client account is created yet — that happens when admin approves
# the application.
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/apply", status_code=200)
async def apply_to_use(
    payload: MerchantApply,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint: submit a merchant application.

    Saves the application (status="pending") so it shows up in the admin
    WhatsApp-setup dashboard's "Pending Applications" list, sends the
    applicant one confirmation email, and posts a Slack alert to the team.
    Returns a success message.

    Guards: honeypot field (silent no-op for bots), IP rate limit (3/hr),
    and a dedupe check against existing pending applications.
    """
    # Honeypot — a real applicant never fills this. Pretend success so a bot
    # doesn't learn it was detected, but skip everything else entirely.
    if payload.website:
        logger.warning(
            "Honeypot triggered on /merchants/apply from %s",
            request.client.host if request.client else "unknown",
        )
        return {"message": "Application received. We'll be in touch within 1–2 business days."}

    from app.core.redis_client import check_apply_rate_limit
    client_ip = request.client.host if request.client else "unknown"
    if not await check_apply_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this connection. Please try again in an hour.",
        )

    try:
        from app.models.merchant_application import MerchantApplication
        from sqlalchemy import or_

        # Dedupe — don't create a second row for someone who already has a
        # pending application (matches on email, and on WhatsApp number if given).
        dedupe_conditions = [MerchantApplication.email == payload.email]
        if payload.whatsapp_number:
            dedupe_conditions.append(MerchantApplication.whatsapp_number == payload.whatsapp_number)

        existing = await db.execute(
            select(MerchantApplication).where(
                MerchantApplication.status == "pending",
                or_(*dedupe_conditions),
            )
        )
        if existing.scalar_one_or_none():
            return {"message": "We already have a pending application from you — we'll be in touch within 1–2 business days."}

        application_id = await _generate_application_id(db)
        link_token     = _generate_link_token()
        application = MerchantApplication(
            id=application_id,
            link_token=link_token,
            business_name=payload.business_name,
            business_type=payload.business_type,
            city_state=payload.city_state,
            full_name=payload.full_name,
            email=payload.email,
            phone_number=payload.phone_number,
            whatsapp_number=payload.whatsapp_number,
            num_branches=payload.num_branches,
            monthly_order_volume=payload.monthly_order_volume,
            uses_whatsapp_manual=payload.uses_whatsapp_manual,
            uses_delivery_service=payload.uses_delivery_service,
            heard_about_us=payload.heard_about_us,
            comments=payload.comments,
            status="pending",
        )
        db.add(application)
        await db.commit()

        from app.services.email_service import send_application_received_email
        from app.api.v1.workers.background_tasks import fire_and_forget

        fire_and_forget(
            send_application_received_email(
                to_email=payload.email,
                applicant_name=payload.full_name,
                business_name=payload.business_name,
                whatsapp_number=payload.whatsapp_number,
                link_token=link_token,
            ),
            name="send_application_received_email",
        )

        # Team-facing notice — Slack + the admin dashboard's Pending
        # Applications panel cover this now, so there's no separate team email.
        try:
            from app.infrastructure.alerting.slack import alert
            fire_and_forget(alert(
                title="New Merchant Application",
                detail=(
                    f"*{payload.business_name}* ({payload.full_name}) just applied. "
                    f"Review it on the admin WhatsApp-setup page."
                ),
                level="info",
                fields={
                    "Application ID": application_id,
                    "Email":    payload.email,
                    "Phone":    payload.phone_number,
                    "WhatsApp": payload.whatsapp_number or "— not provided —",
                    "City":     payload.city_state,
                    "Type":     payload.business_type,
                    "Volume":   payload.monthly_order_volume,
                },
            ), name="slack_new_application")
        except Exception:
            pass

        return {"message": "Application received. We'll be in touch within 1–2 business days."}

    except HTTPException:
        raise
    except Exception:
        logger.exception("Merchant application submission failed")
        raise HTTPException(status_code=500, detail="Submission failed. Please try again.")


# ─────────────────────────────────────────────────────────────────────────────
# ADD WHATSAPP NUMBER  (public, token-based)
# Backs the link sent in the apply-confirmation email when no WhatsApp number
# was given at application time. Public template: templates/add_whatsapp_number.html
# (served at GET /apply/whatsapp-number?token=... — see main.py).
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/apply/link/{token}")
async def get_application_by_link(token: str, db: AsyncSession = Depends(get_db)):
    from app.models.merchant_application import MerchantApplication

    res = await db.execute(
        select(MerchantApplication).where(MerchantApplication.link_token == token)
    )
    application = res.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="This link isn't valid.")
    if application.status not in _OPEN_APPLICATION_STATUSES:
        raise HTTPException(status_code=410, detail="This application has already been processed.")

    return {
        "business_name":       application.business_name,
        "full_name":            application.full_name,
        "has_whatsapp_number": bool(application.whatsapp_number),
    }


@router.post("/apply/link/{token}")
async def submit_whatsapp_number_for_application(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    from app.models.merchant_application import MerchantApplication
    from app.schemas.merchant import _normalise_phone

    res = await db.execute(
        select(MerchantApplication).where(MerchantApplication.link_token == token)
    )
    application = res.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="This link isn't valid.")
    if application.status not in _OPEN_APPLICATION_STATUSES:
        raise HTTPException(status_code=410, detail="This application has already been processed.")

    body = await request.json()
    try:
        whatsapp_number = _normalise_phone(str(body.get("whatsapp_number", "")))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if not whatsapp_number:
        raise HTTPException(status_code=422, detail="Enter a valid WhatsApp number.")

    application.whatsapp_number = whatsapp_number
    await db.commit()

    try:
        from app.infrastructure.alerting.slack import alert
        from app.api.v1.workers.background_tasks import fire_and_forget
        fire_and_forget(alert(
            title="Application Updated — WhatsApp Number Added",
            detail=f"*{application.business_name}* added their WhatsApp number. Ready to review.",
            level="info",
            fields={
                "Application ID": application.id,
                "WhatsApp":       f"+{whatsapp_number}",
            },
        ), name="slack_application_number_added")
    except Exception:
        pass

    return {"ok": True, "message": "Thanks! We'll reach out to you on WhatsApp to continue."}


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
    # FIX: was payload.merchant_id — authenticate() queries by email, not merchant_id
    merchant = await service.authenticate(payload.email, payload.password)
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
