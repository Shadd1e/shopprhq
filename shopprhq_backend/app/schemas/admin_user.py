import logging
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.admin_user import VALID_ADMIN_PERMISSIONS

logger = logging.getLogger(__name__)


def _check_permissions(v: List[str]) -> List[str]:
    unknown = set(v) - VALID_ADMIN_PERMISSIONS
    if unknown:
        raise ValueError(f"Unknown permission(s): {', '.join(sorted(unknown))}")
    return sorted(set(v))


# ─────────────────────────────────────────────────────────────────────────────
# Login
# ─────────────────────────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class AdminLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    admin_id: str
    name: str
    is_superadmin: bool
    permissions: List[str]
    must_change_password: bool


class AdminChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(..., min_length=8)


# ─────────────────────────────────────────────────────────────────────────────
# Worker management (superadmin only)
# ─────────────────────────────────────────────────────────────────────────────

class WorkerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    permissions: List[str] = Field(default_factory=list)

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v):
        return _check_permissions(v)


class WorkerCreateResponse(BaseModel):
    id: str
    name: str
    email: str
    permissions: List[str]
    temporary_password: str  # shown once — hand this to the worker directly


class WorkerUpdate(BaseModel):
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, v):
        if v is None:
            return v
        return _check_permissions(v)


class WorkerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    is_superadmin: bool
    permissions: List[str]
    is_active: bool
    must_change_password: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime


class WorkerResetPasswordResponse(BaseModel):
    id: str
    temporary_password: str
