# app/core/admin_auth.py
"""
Auth for real admin accounts (superadmins + workers), issued from
app/api/v1/admin_auth.py.

This is deliberately independent of app.core.security's
create_access_token/decode_access_token (which is merchant/client-scoped
and read by the global TenantMiddleware) — admin tokens are verified
directly here, off the standard Authorization header, so nothing about
merchant/client auth is touched.

Two ways to satisfy an admin route now:
  1. Legacy shared-secret session — `X-Admin-Token` header, validated
     against Redis (app/core/redis_client.py). Full superadmin access.
     This is the pre-existing ADMIN_SECRET flow and is left as-is.
  2. Real account — `Authorization: Bearer <token>` issued by
     POST /admin/auth/login. Superadmins get full access; workers are
     checked against their stored `permissions` list.
"""
import os
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt as pyjwt
from fastapi import Request, HTTPException, status

from app.core.config import settings
from app.core.redis_client import validate_admin_session

logger = logging.getLogger(__name__)

ADMIN_TOKEN_TYPE = "admin"
ADMIN_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours


@dataclass
class AdminContext:
    admin_id: Optional[str]
    name: str
    is_superadmin: bool
    permissions: list = field(default_factory=list)
    via: str = "jwt"  # "jwt" | "legacy_secret"

    def has_permission(self, permission: str) -> bool:
        return self.is_superadmin or permission in self.permissions


# ================================================================
# TOKEN ISSUE / DECODE
# ================================================================

def create_admin_token(admin) -> str:
    """admin: AdminUser instance."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ADMIN_TOKEN_EXPIRE_MINUTES)
    payload = {
        "exp": expire,
        "sub": admin.id,
        "type": ADMIN_TOKEN_TYPE,
        "is_superadmin": bool(admin.is_superadmin),
        "permissions": admin.permissions or [],
    }
    return pyjwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_admin_token(token: str) -> Optional[dict]:
    try:
        payload = pyjwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except Exception:
        return None
    if payload.get("type") != ADMIN_TOKEN_TYPE:
        return None
    return payload


# ================================================================
# FASTAPI DEPENDENCIES
# ================================================================

async def _resolve_admin_context(request: Request) -> Optional[AdminContext]:
    # 1. Legacy shared-secret session (full access) — gated behind
    # LEGACY_ADMIN_LOGIN_ENABLED so it can be killed instantly. Checked here,
    # not just at the login endpoint, so an already-issued session token
    # (still valid in Redis) also stops working the moment this flips —
    # not just new logins.
    if os.getenv("LEGACY_ADMIN_LOGIN_ENABLED", "true").lower() != "false":
        legacy_token = request.headers.get("X-Admin-Token")
        if legacy_token and await validate_admin_session(legacy_token):
            return AdminContext(
                admin_id=None,
                name="superadmin (shared secret)",
                is_superadmin=True,
                permissions=[],
                via="legacy_secret",
            )

    # 2. Real account JWT
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = decode_admin_token(auth_header[7:])
        if payload:
            return AdminContext(
                admin_id=payload.get("sub"),
                name=payload.get("sub", ""),
                is_superadmin=bool(payload.get("is_superadmin")),
                permissions=payload.get("permissions") or [],
                via="jwt",
            )

    return None


async def require_admin(request: Request) -> AdminContext:
    """Any valid admin — superadmin or worker with at least one permission."""
    ctx = await _resolve_admin_context(request)
    if not ctx:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin login required")
    return ctx


def require_admin_permission(permission: str):
    """
    Dependency factory — use per-route:
        Depends(require_admin_permission("manage_whatsapp_onboarding"))
    Superadmins (via either auth path) always pass.
    """
    async def _dependency(request: Request) -> AdminContext:
        ctx = await _resolve_admin_context(request)
        if not ctx:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin login required")
        if not ctx.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your admin account doesn't have the '{permission}' permission.",
            )
        return ctx

    return _dependency


async def require_superadmin(request: Request) -> AdminContext:
    ctx = await _resolve_admin_context(request)
    if not ctx:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin login required")
    if not ctx.is_superadmin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Superadmin access required")
    return ctx
