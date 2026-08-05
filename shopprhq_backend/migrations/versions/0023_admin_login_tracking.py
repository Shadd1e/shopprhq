"""add login tracking columns to admin_users

Revision ID: 0023_admin_login_tracking
Revises: 0022_admin_users
Create Date: 2026-08-05

Adds last_login_ip and last_login_device so every admin login (superadmin
or worker) can be surfaced in a notification email with a time/device
fingerprint attached, per the login-notification feature.
"""
from alembic import op
import sqlalchemy as sa

revision      = "0023_admin_login_tracking"
down_revision = "0022_admin_users"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.add_column("admin_users", sa.Column("last_login_ip", sa.String(64), nullable=True))
    op.add_column("admin_users", sa.Column("last_login_device", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("admin_users", "last_login_device")
    op.drop_column("admin_users", "last_login_ip")
