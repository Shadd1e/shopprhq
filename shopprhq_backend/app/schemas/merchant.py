import logging
logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.schemas.merchant import (
    MerchantCreate, MerchantRead, MerchantUpdate, MerchantLogin, MerchantApply,
    ApplyStepOne, ApplyStepTwo, ApplyStepThree, ApplyStepFour,
)
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
# (served at GET /apply/whatsapp-number/{token} — see main.py).
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
# ONBOARDING WIZARD  (public, resumable, 4 steps)
#   1. POST   /apply/start                      -> create draft, get resume_token
#   2. GET    /apply/resume/{token}              -> fetch current draft state
#   3. PATCH  /apply/resume/{token}/business     -> step 2: business details
#   4. PATCH  /apply/resume/{token}/verification -> step 3: CAC or BVN/NIN
#   5. POST   /apply/resume/{token}/submit       -> step 4: terms + indemnity,
#                                                   finalizes status="pending"
#
# resume_token is a separate concept from link_token above — link_token only
# ever backs the older "add WhatsApp number to an already-submitted
# application" page. resume_token is the bearer credential for an
# in-progress, not-yet-submitted draft.
# ─────────────────────────────────────────────────────────────────────────────

_RESUME_TOKEN_TTL_DAYS = 14


def _generate_resume_token() -> str:
    import secrets
    return secrets.token_urlsafe(24)


async def _get_draft_or_404(token: str, db: AsyncSession):
    from datetime import datetime, timezone
    from app.models.merchant_application import MerchantApplication

    res = await db.execute(
        select(MerchantApplication).where(MerchantApplication.resume_token == token)
    )
    application = res.scalar_one_or_none()
    if not application:
        raise HTTPException(status_code=404, detail="This link isn't valid.")
    if application.status != "draft":
        raise HTTPException(status_code=410, detail="This application has already been submitted.")
    if application.resume_token_expires_at and application.resume_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=410,
            detail="This link has expired. Please start a new application — your progress couldn't be carried over.",
        )
    return application


@router.post("/apply/start", status_code=200)
async def apply_start(
    payload: ApplyStepOne,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 1 of the onboarding wizard. Creates a draft application and returns
    a resume_token the frontend keeps (in the URL or local storage) to PATCH
    through the remaining steps, and to let the applicant come back later.

    Duplicate handling: if this email or phone already has an open draft (or
    a submitted application still pending review), don't create a second row
    — return the existing resume_token (for an open draft) or a plain message
    (for one already submitted/under review) instead.
    """
    if payload.website:
        logger.warning(
            "Honeypot triggered on /merchants/apply/start from %s",
            request.client.host if request.client else "unknown",
        )
        return {"resume_token": _generate_resume_token(), "current_step": 1}  # inert — never persisted

    from app.core.redis_client import check_apply_rate_limit
    client_ip = request.client.host if request.client else "unknown"
    if not await check_apply_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many submissions from this connection. Please try again in an hour.",
        )

    from datetime import datetime, timezone, timedelta
    from app.models.merchant_application import MerchantApplication
    from sqlalchemy import or_

    dedupe_conditions = [MerchantApplication.email == payload.email]
    if payload.whatsapp_number:
        dedupe_conditions.append(MerchantApplication.whatsapp_number == payload.whatsapp_number)
    dedupe_conditions.append(MerchantApplication.phone_number == payload.phone_number)

    existing_res = await db.execute(
        select(MerchantApplication).where(
            MerchantApplication.status.in_(("draft", "pending", "needs_attention")),
            or_(*dedupe_conditions),
        )
    )
    existing = existing_res.scalars().first()
    if existing:
        if existing.status == "draft":
            # Refresh an expired token rather than starting over.
            now = datetime.now(timezone.utc)
            if not existing.resume_token_expires_at or existing.resume_token_expires_at < now:
                existing.resume_token = _generate_resume_token()
                existing.resume_token_expires_at = now + timedelta(days=_RESUME_TOKEN_TTL_DAYS)
                await db.commit()
            return {
                "resume_token": existing.resume_token,
                "current_step": existing.current_step,
                "message": "You already have an application in progress — picking up where you left off.",
            }
        return {
            "resume_token": None,
            "current_step": None,
            "message": "We already have an application from you under review. We'll be in touch within 1–2 business days.",
        }

    now = datetime.now(timezone.utc)
    application_id = await _generate_application_id(db)
    resume_token    = _generate_resume_token()
    application = MerchantApplication(
        id=application_id,
        full_name=payload.full_name,
        email=payload.email,
        phone_number=payload.phone_number,
        whatsapp_number=payload.whatsapp_number,
        status="draft",
        current_step=1,
        resume_token=resume_token,
        resume_token_expires_at=now + timedelta(days=_RESUME_TOKEN_TTL_DAYS),
        last_activity_at=now,
    )
    db.add(application)
    await db.commit()

    return {"resume_token": resume_token, "current_step": 1}


@router.get("/apply/resume/{token}")
async def apply_resume(token: str, db: AsyncSession = Depends(get_db)):
    """Fetch current draft state so the frontend can prefill the wizard on return."""
    application = await _get_draft_or_404(token, db)
    return {
        "current_step":        application.current_step,
        "full_name":           application.full_name,
        "email":               application.email,
        "phone_number":        application.phone_number,
        "whatsapp_number":     application.whatsapp_number,
        "business_name":       application.business_name,
        "business_type":       application.business_type,
        "city_state":          application.city_state,
        "registration_status": application.registration_status,
        "num_branches":        application.num_branches,
        "monthly_order_volume": application.monthly_order_volume,
        "uses_whatsapp_manual": application.uses_whatsapp_manual,
        "uses_delivery_service": application.uses_delivery_service,
        "heard_about_us":      application.heard_about_us,
        "comments":            application.comments,
        "verification_method": application.verification_method,
        "verification_status": application.verification_status,
        # Never return raw cac_number/bvn/nin — just whether one's on file.
        "has_cac_number":      bool(application.cac_number),
        "has_bvn":             bool(application.bvn),
        "has_nin":             bool(application.nin),
    }


@router.patch("/apply/resume/{token}/business")
async def apply_step_business(
    token: str,
    payload: ApplyStepTwo,
    db: AsyncSession = Depends(get_db),
):
    """Step 2: business details, including the registered/unregistered choice."""
    from datetime import datetime, timezone

    application = await _get_draft_or_404(token, db)

    application.business_name         = payload.business_name
    application.business_type         = payload.business_type
    application.city_state            = payload.city_state
    application.registration_status   = payload.registration_status
    application.num_branches          = payload.num_branches
    application.monthly_order_volume  = payload.monthly_order_volume
    application.uses_whatsapp_manual  = payload.uses_whatsapp_manual
    application.uses_delivery_service = payload.uses_delivery_service
    application.heard_about_us        = payload.heard_about_us
    application.comments              = payload.comments
    application.current_step          = max(application.current_step, 2)
    application.last_activity_at      = datetime.now(timezone.utc)

    await db.commit()
    return {"current_step": application.current_step, "registration_status": application.registration_status}


@router.patch("/apply/resume/{token}/verification")
async def apply_step_verification(
    token: str,
    payload: ApplyStepThree,
    db: AsyncSession = Depends(get_db),
):
    """
    Step 3: verification. Branches on registration_status set in step 2 —
    registered businesses verify with their CAC number; unregistered
    applicants choose BVN or NIN.
    """
    from datetime import datetime, timezone
    from app.services.verification_service import verify_cac, verify_bvn, verify_nin, get_transaction_limit

    application = await _get_draft_or_404(token, db)
    if not application.registration_status:
        raise HTTPException(status_code=400, detail="Complete the business details step first.")

    if application.registration_status == "registered":
        if not payload.cac_number:
            raise HTTPException(status_code=422, detail="CAC number is required for a registered business.")
        result = await verify_cac(payload.cac_number, application.business_name)
        application.cac_number          = payload.cac_number
        application.verification_method = "cac"
    else:
        if not payload.verification_method:
            raise HTTPException(status_code=422, detail="Choose BVN or NIN verification.")
        if payload.verification_method == "bvn":
            if not payload.bvn:
                raise HTTPException(status_code=422, detail="BVN is required.")
            result = await verify_bvn(payload.bvn, application.full_name)
            application.bvn = payload.bvn
        else:
            if not payload.nin:
                raise HTTPException(status_code=422, detail="NIN is required.")
            result = await verify_nin(payload.nin, application.full_name)
            application.nin = payload.nin
        application.verification_method = payload.verification_method

    application.verification_status     = result.status
    application.verification_name_on_file = result.name_on_file
    application.transaction_limit       = get_transaction_limit(application.registration_status, result.status)
    application.current_step            = max(application.current_step, 3)
    application.last_activity_at        = datetime.now(timezone.utc)

    await db.commit()

    if result.status == "failed":
        try:
            from app.infrastructure.alerting.slack import alert
            from app.api.v1.workers.background_tasks import fire_and_forget
            fire_and_forget(alert(
                title="Merchant Verification Failed",
                detail=f"*{application.business_name or application.full_name}* failed {application.verification_method} verification.",
                level="warning",
                fields={"Application ID": application.id, "Reason": result.reason or "—"},
            ), name="slack_verification_failed")
        except Exception:
            pass

    return {
        "current_step": application.current_step,
        "verification_status": application.verification_status,
        "transaction_limit": float(application.transaction_limit) if application.transaction_limit else None,
    }


@router.post("/apply/resume/{token}/submit")
async def apply_step_submit(
    token: str,
    payload: ApplyStepFour,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Step 4: terms + indemnity acceptance. Finalizes the application as 'pending' review."""
    from datetime import datetime, timezone

    application = await _get_draft_or_404(token, db)
    if not application.business_name or not application.registration_status:
        raise HTTPException(status_code=400, detail="Complete the business details step first.")
    if not application.verification_status:
        raise HTTPException(status_code=400, detail="Complete the verification step first.")

    application.terms_version     = payload.terms_version
    application.terms_accepted    = True
    application.terms_accepted_at = datetime.now(timezone.utc)
    application.terms_accepted_ip = request.client.host if request.client else None
    application.current_step      = 4
    application.status            = "pending"
    application.last_activity_at  = datetime.now(timezone.utc)

    # send_application_received_email needs a link_token to build the
    # "add your WhatsApp number" link when one wasn't given — the wizard
    # never generates one earlier, so do it here if it's still missing.
    if not application.whatsapp_number and not application.link_token:
        application.link_token = _generate_link_token()

    await db.commit()

    from app.services.email_service import send_application_received_email
    from app.api.v1.workers.background_tasks import fire_and_forget

    fire_and_forget(
        send_application_received_email(
            to_email=application.email,
            applicant_name=application.full_name,
            business_name=application.business_name,
            whatsapp_number=application.whatsapp_number,
            link_token=application.link_token,
        ),
        name="send_application_received_email",
    )

    try:
        from app.infrastructure.alerting.slack import alert
        fire_and_forget(alert(
            title="New Merchant Application",
            detail=f"*{application.business_name}* ({application.full_name}) just submitted a complete application.",
            level="info",
            fields={
                "Application ID":  application.id,
                "Email":           application.email,
                "Phone":           application.phone_number,
                "WhatsApp":        application.whatsapp_number or "— not provided —",
                "City":            application.city_state,
                "Registration":    application.registration_status,
                "Verification":    f"{application.verification_method} → {application.verification_status}",
                "Txn limit":       f"₦{application.transaction_limit:,.0f}" if application.transaction_limit else "—",
            },
        ), name="slack_new_application")
    except Exception:
        pass

    return {"message": "Application received. We'll be in touch within 1–2 business days.", "application_id": application.id}


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
async def login_merchant(payload: MerchantLogin, request: Request, db: AsyncSession = Depends(get_db)):
    from app.core.security import create_access_token
    from app.core.redis_client import check_login_rate_limit

    client_ip = request.client.host if request.client else "unknown"
    if not await check_login_rate_limit(client_ip, payload.email):
        raise HTTPException(
            status_code=429,
            detail="Too many login attempts. Please wait 15 minutes before trying again.",
            headers={"Retry-After": "900"},
        )

    service  = MerchantService(db)
    merchant = await service.authenticate(payload.email, payload.password)
    if not merchant:
        raise HTTPException(status_code=401, detail="Invalid credentials or account locked")
    token          = create_access_token(subject=merchant.id)
    email_verified = getattr(merchant, "email_verified", False) or False
    must_change_pw = getattr(merchant, "must_change_password", False) or False
    return {
        "access_token":        token,
        "token_type":          "bearer",
        "merchant_id":         merchant.id,
        "name":                merchant.name,
        "email":               merchant.email,
        "email_verified":      email_verified,
        "must_change_password": must_change_pw,
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
    from app.core.redis_client import check_login_rate_limit

    body  = await request.json()
    email = (body.get("email") or "").strip().lower()

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email address is required.")

    client_ip = request.client.host if request.client else "unknown"
    if not await check_login_rate_limit(client_ip, email):
        # Return the same generic message — don't confirm the email exists or reveal the limit
        return {"detail": "If that email is registered, a reset code has been sent."}

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

    merchant.password_hash        = get_password_hash(new_password)
    merchant.failed_attempts      = 0   # clear any lockout
    merchant.must_change_password = False  # first-login gate satisfied
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
