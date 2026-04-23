"""make client whatsapp_number and store_contact_number nullable for auto-created stores

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('clients', 'whatsapp_number',
        existing_type=sa.String(length=20),
        nullable=True,
    )
    op.alter_column('clients', 'store_contact_number',
        existing_type=sa.String(length=20),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column('clients', 'store_contact_number',
        existing_type=sa.String(length=20),
        nullable=False,
    )
    op.alter_column('clients', 'whatsapp_number',
        existing_type=sa.String(length=20),
        nullable=False,
    )
