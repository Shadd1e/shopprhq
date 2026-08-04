"""create admin_users table

Revision ID: 0022_admin_users
Revises: 0021_credential_verified
Create Date: 2026-08-03

Adds real accounts for the internal admin panel (superadmins + workers),
sitting alongside the existing ADMIN_SECRET/Redis-session login rather
than replacing it. Workers get a curated `permissions` checklist assigned
by a superadmin when created.
"""
from alembic import op
import sqlalchemy as sa

revision      = "0022_admin_users"
down_revision = "0021_credential_verified"
branch_labels = None
depends_on    = None


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.String(36), primary_key=True),

        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),

        sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("permissions", sa.JSON(), nullable=False, server_default="[]"),

        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default="0"),

        sa.Column("created_by", sa.String(36), sa.ForeignKey("admin_users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_admin_users_email", "admin_users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_admin_users_email", table_name="admin_users")
    op.drop_table("admin_users")
