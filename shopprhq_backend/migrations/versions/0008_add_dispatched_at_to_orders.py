"""Add missing dispatched_at column to orders table

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-26

Why this exists:
  Migration 0007 added delivery fields to the orders table but missed the
  dispatched_at timestamp column that was added to the Order model.
  SQLAlchemy is trying to SELECT it and crashing with UndefinedColumnError.
"""

from alembic import op
import sqlalchemy as sa

revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('orders',
        sa.Column(
            'dispatched_at',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Set when merchant marks a delivery order as OUT_FOR_DELIVERY',
        )
    )


def downgrade() -> None:
    op.drop_column('orders', 'dispatched_at')
