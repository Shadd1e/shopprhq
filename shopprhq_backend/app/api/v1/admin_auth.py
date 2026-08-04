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

    service = AdminUserService(db)
    admin = await service.authenticate(payload.email, payload.password)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_admin_token(admin)
    logger.info("Admin login — id=%s email=%s ip=%s", admin.id, admin.email, client_ip)
    return AdminLoginResponse(
        access_token=token,
        admin_id=admin.id,
        name=admin.name,
        is_superadmin=admin.is_superadmin,
        permissions=admin.permissions or [],
        must_change_password=admin.must_change_password,
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
