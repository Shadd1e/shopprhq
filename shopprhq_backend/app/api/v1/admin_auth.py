# app/api/v1/admin_auth.py
"""
Real admin accounts: login for superadmins/workers, and worker management.

Sits alongside app/api/v1/admin_whatsapp.py's ADMIN_SECRET login
(POST /admin/whatsapp-setup/verify-password) rather than replacing it —
that shared-secret flow keeps working as a superadmin fallback.

  POST   /admin/auth/login                 — any admin account
  POST   /admin/auth/change-password       — any logged-in admin
  GET    /admin/workers                    — superadmin only
  POST   /admin/workers                    — superadmin only
  PATCH  /admin/workers/{worker_id}        — superadmin only
  POST   /admin/workers/{worker_id}/reset-password  — superadmin only
"""
import os
import hmac
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.deps import get_db
from app.core.helpers import get_client_ip
from app.core.redis_client import check_admin_rate_limit
from app.core.admin_auth import (
    create_admin_token,
    require_admin,
    require_superadmin,
    AdminContext,
)
from app.services.admin_user_service import AdminUserService
from app.schemas.admin_user import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminChangePasswordRequest,
    WorkerCreate,
    WorkerCreateResponse,
    WorkerUpdate,
    WorkerOut,
    WorkerResetPasswordResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin — Accounts"])


# ── LOGIN ──────────────────────────────────────────────────────────────────────

@router.post("/auth/login", response_model=AdminLoginResponse)
async def admin_login(
    payload: AdminLoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_client_ip(request)
    if not await check_admin_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many attempts — try again in 5 minutes.")

    user_agent = request.headers.get("User-Agent", "unknown")

    service = AdminUserService(db)
    admin = await service.authenticate(payload.email, payload.password, ip=client_ip, device=user_agent)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.flush()
    token = create_admin_token(admin)
    logger.info("Admin login — id=%s email=%s ip=%s", admin.id, admin.email, client_ip)

    await _send_login_notification(service, admin, ip=client_ip, device=user_agent)

    return AdminLoginResponse(
        access_token=token,
        admin_id=admin.id,
        name=admin.name,
        is_superadmin=admin.is_superadmin,
        permissions=admin.permissions or [],
        must_change_password=admin.must_change_password,
    )


async def _send_login_notification(service: AdminUserService, admin, *, ip: str, device: str) -> None:
    """
    Superadmin login  -> emails that same superadmin only (self security alert).
    Worker login      -> emails every active superadmin, with the worker's
                          name, login time, IP, and device — time/device are
                          also persisted on the row itself (last_login_ip /
                          last_login_device) regardless of whether the email
                          send succeeds.
    """
    from app.services.email_service import send_email
    from app.api.v1.workers.background_tasks import fire_and_forget

    when = admin.last_login_at.strftime("%Y-%m-%d %H:%M UTC") if admin.last_login_at else "just now"

    if admin.is_superadmin:
        recipients = [admin.email]
        subject = "New login to your ShopprHQ admin account"
        html = (
            f"<p>Hi {admin.name},</p>"
            f"<p>Your ShopprHQ superadmin account was just signed in to.</p>"
            f"<p><b>Time:</b> {when}<br><b>IP:</b> {ip}<br><b>Device:</b> {device}</p>"
            f"<p>If this wasn't you, rotate your password and the shared admin "
            f"secret immediately.</p>"
        )
        text = (
            f"Hi {admin.name},\n\nYour ShopprHQ superadmin account was just signed in to.\n"
            f"Time: {when}\nIP: {ip}\nDevice: {device}\n\n"
            f"If this wasn't you, rotate your password and the shared admin secret immediately."
        )
    else:
        superadmins = await service.list_superadmins()
        recipients = [s.email for s in superadmins]
        if not recipients:
            return
        subject = f"Worker login: {admin.name}"
        html = (
            f"<p>{admin.name} ({admin.email}) just logged into the ShopprHQ admin panel.</p>"
            f"<p><b>Time:</b> {when}<br><b>IP:</b> {ip}<br><b>Device:</b> {device}</p>"
        )
        text = (
            f"{admin.name} ({admin.email}) just logged into the ShopprHQ admin panel.\n"
            f"Time: {when}\nIP: {ip}\nDevice: {device}"
        )

    for to_email in recipients:
        fire_and_forget(
            lambda to_email=to_email: send_email(to_email=to_email, subject=subject, html=html, text=text),
            name=f"admin_login_notification_{admin.id}",
        )


@router.post("/auth/change-password")
async def admin_change_password(
    payload: AdminChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    ctx: AdminContext = Depends(require_admin),
):
    if not ctx.admin_id:
        # Logged in via the legacy shared-secret session — nothing to change here.
        raise HTTPException(status_code=400, detail="Not applicable to shared-secret sessions")

    service = AdminUserService(db)
    admin = await service.get(ctx.admin_id)
    if not admin:
        raise HTTPException(status_code=404, detail="Admin account not found")

    if not admin.must_change_password:
        from app.core.security import verify_password
        if not payload.current_password or not verify_password(payload.current_password, admin.password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")

    await service.change_password(admin, payload.new_password)
    return {"ok": True}


# ── WORKER MANAGEMENT (superadmin only) ─────────────────────────────────────────

@router.get("/workers", response_model=list[WorkerOut])
async def list_workers(
    db: AsyncSession = Depends(get_db),
    _: AdminContext = Depends(require_superadmin),
):
    service = AdminUserService(db)
    return await service.list_all()


@router.post("/workers", response_model=WorkerCreateResponse)
async def create_worker(
    payload: WorkerCreate,
    db: AsyncSession = Depends(get_db),
    ctx: AdminContext = Depends(require_superadmin),
):
    # Step-up check — a valid superadmin JWT alone isn't enough to mint new
    # admin accounts. Re-confirm with the shared ADMIN_SECRET, same as the
    # legacy login, so a leaked/stolen bearer token can't be used on its own
    # to create backdoor accounts.
    admin_secret = os.getenv("ADMIN_SECRET", "")
    if not admin_secret or not hmac.compare_digest(payload.admin_secret, admin_secret):
        raise HTTPException(status_code=401, detail="Admin secret confirmation is incorrect")

    service = AdminUserService(db)
    try:
        worker, temp_password = await service.create_worker(
            name=payload.name,
            email=payload.email,
            permissions=payload.permissions,
            created_by=ctx.admin_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    await db.flush()
    logger.info("Worker created — id=%s email=%s by=%s", worker.id, worker.email, ctx.admin_id)

    try:
        from app.services.email_service import send_email
        login_url = os.getenv("APP_URL", "https://shopprhq.com") + "/admin/accounts"
        await send_email(
            to_email=worker.email,
            subject="Your ShopprHQ admin access",
            html=(
                f"<p>Hi {worker.name},</p>"
                f"<p>A ShopprHQ superadmin created an admin account for you.</p>"
                f"<p><b>Email:</b> {worker.email}<br>"
                f"<b>Temporary password:</b> {temp_password}</p>"
                f"<p>Sign in at <a href=\"{login_url}\">{login_url}</a> — "
                f"you'll be asked to set your own password on first login.</p>"
                f"<p>If you weren't expecting this, ignore this email.</p>"
            ),
            text=(
                f"Hi {worker.name},\n\n"
                f"A ShopprHQ superadmin created an admin account for you.\n"
                f"Email: {worker.email}\n"
                f"Temporary password: {temp_password}\n\n"
                f"Sign in at {login_url} — you'll be asked to set your own "
                f"password on first login.\n\n"
                f"If you weren't expecting this, ignore this email."
            ),
        )
    except Exception as email_err:
        # Don't fail worker creation just because the email didn't go out —
        # the temp password is still returned below so the superadmin can
        # hand it over directly.
        logger.error("Worker invite email failed for %s: %s", worker.email, email_err)

    return WorkerCreateResponse(
        id=worker.id,
        name=worker.name,
        email=worker.email,
        permissions=worker.permissions or [],
        temporary_password=temp_password,
    )


@router.patch("/workers/{worker_id}", response_model=WorkerOut)
async def update_worker(
    worker_id: str,
    payload: WorkerUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminContext = Depends(require_superadmin),
):
    service = AdminUserService(db)
    worker = await service.get(worker_id)
    if not worker or worker.is_superadmin:
        raise HTTPException(status_code=404, detail="Worker not found")

    await service.update_worker(worker, payload.permissions, payload.is_active)
    return worker


@router.post("/workers/{worker_id}/reset-password", response_model=WorkerResetPasswordResponse)
async def reset_worker_password(
    worker_id: str,
    db: AsyncSession = Depends(get_db),
    _: AdminContext = Depends(require_superadmin),
):
    service = AdminUserService(db)
    worker = await service.get(worker_id)
    if not worker or worker.is_superadmin:
        raise HTTPException(status_code=404, detail="Worker not found")

    temp_password = await service.reset_password(worker)
    return WorkerResetPasswordResponse(id=worker.id, temporary_password=temp_password)
