from typing import Optional, List
import secrets
import string
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.admin_user import AdminUser
from app.core.security import hash_password, verify_password
import logging

logger = logging.getLogger(__name__)

MAX_FAILED_ATTEMPTS = 6


def _generate_temp_password() -> str:
    """Readable-ish random password for a newly created worker, e.g. 'k7m2-p9qz-x4nt'."""
    alphabet = string.ascii_lowercase + string.digits
    chunks = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
    return "-".join(chunks)


class AdminUserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> Optional[AdminUser]:
        result = await self.db.execute(select(AdminUser).where(AdminUser.email == email))
        return result.scalars().first()

    async def get(self, admin_id: str) -> Optional[AdminUser]:
        result = await self.db.execute(select(AdminUser).where(AdminUser.id == admin_id))
        return result.scalars().first()

    async def list_all(self) -> List[AdminUser]:
        result = await self.db.execute(select(AdminUser).order_by(AdminUser.created_at.desc()))
        return list(result.scalars().all())

    async def list_superadmins(self) -> List[AdminUser]:
        result = await self.db.execute(
            select(AdminUser).where(AdminUser.is_superadmin.is_(True), AdminUser.is_active.is_(True))
        )
        return list(result.scalars().all())

    async def authenticate(
        self, email: str, password: str, *, ip: Optional[str] = None, device: Optional[str] = None,
    ) -> Optional[AdminUser]:
        admin = await self.get_by_email(email)
        if not admin or not admin.is_active:
            return None
        if admin.failed_attempts >= MAX_FAILED_ATTEMPTS:
            return None
        if verify_password(password, admin.password_hash):
            admin.failed_attempts = 0
            from datetime import datetime, timezone
            admin.last_login_at = datetime.now(timezone.utc)
            admin.last_login_ip = ip
            admin.last_login_device = (device or "")[:500] or None
            return admin
        admin.failed_attempts += 1
        return None

    async def create_superadmin(self, name: str, email: str, password: str) -> AdminUser:
        admin = AdminUser(
            name=name,
            email=email,
            password_hash=hash_password(password),
            is_superadmin=True,
            permissions=[],
            is_active=True,
            must_change_password=False,
        )
        self.db.add(admin)
        return admin

    async def create_worker(
        self, name: str, email: str, permissions: List[str], created_by: str,
    ) -> tuple[AdminUser, str]:
        """Returns (worker, temporary_password) — the plaintext password is
        only ever available here, at creation time."""
        existing = await self.get_by_email(email)
        if existing:
            raise ValueError("An admin account with that email already exists.")

        temp_password = _generate_temp_password()
        worker = AdminUser(
            name=name,
            email=email,
            password_hash=hash_password(temp_password),
            is_superadmin=False,
            permissions=permissions,
            is_active=True,
            must_change_password=True,
            created_by=created_by,
        )
        self.db.add(worker)
        return worker, temp_password

    async def update_worker(
        self, worker: AdminUser, permissions: Optional[List[str]], is_active: Optional[bool],
    ) -> AdminUser:
        if permissions is not None:
            worker.permissions = permissions
        if is_active is not None:
            worker.is_active = is_active
        return worker

    async def reset_password(self, worker: AdminUser) -> str:
        temp_password = _generate_temp_password()
        worker.password_hash = hash_password(temp_password)
        worker.must_change_password = True
        worker.failed_attempts = 0
        return temp_password

    async def change_password(self, admin: AdminUser, new_password: str) -> None:
        admin.password_hash = hash_password(new_password)
        admin.must_change_password = False
