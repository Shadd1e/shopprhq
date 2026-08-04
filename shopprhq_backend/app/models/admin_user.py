# app/models/admin_user.py
"""
Internal platform admin accounts — separate from Merchant (store owners).

Two kinds of row live in this table:
  - superadmins  (is_superadmin=True)  — full access, can create/manage workers
  - workers      (is_superadmin=False) — access limited to whatever keys are
                                          present in `permissions`

This sits alongside the existing ADMIN_SECRET/Redis-session login
(app/api/v1/admin_whatsapp.py) rather than replacing it — that shared
secret keeps working as a superadmin fallback.
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Integer, func
from sqlalchemy.dialects.postgresql import JSON
from app.db.base import Base
from .utils import generate_uuid
import logging

logger = logging.getLogger(__name__)

# Fixed set of assignable permission keys. Add new ones here as new admin
# capabilities are gated — nothing else needs to change to support a new key.
VALID_ADMIN_PERMISSIONS = {
    "view_clients",
    "manage_whatsapp_onboarding",
    "manage_merchant_applications",
}


class AdminUser(Base):
    __tablename__ = "admin_users"

    id             = Column(String(36), primary_key=True, default=generate_uuid)
    name           = Column(String(255), nullable=False)
    email          = Column(String(255), unique=True, nullable=False, index=True)
    password_hash  = Column(String(255), nullable=False)

    is_superadmin  = Column(Boolean, default=False, nullable=False)
    # List of strings, e.g. ["view_clients", "manage_whatsapp_onboarding"].
    # Ignored for superadmins, who implicitly have every permission.
    permissions    = Column(JSON, nullable=False, default=list)

    is_active      = Column(
        Boolean, default=True, nullable=False,
        comment="Flip to False to instantly revoke a worker's access without deleting them.",
    )
    must_change_password = Column(
        Boolean, default=False, nullable=False,
        comment="Set True when a superadmin creates the account with a generated "
                "password. Cleared on first successful password change.",
    )
    failed_attempts = Column(Integer, default=0, nullable=False)

    created_by = Column(String(36), ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<AdminUser(id={self.id}, email={self.email}, superadmin={self.is_superadmin})>"

    def has_permission(self, permission: str) -> bool:
        if self.is_superadmin:
            return True
        return permission in (self.permissions or [])
