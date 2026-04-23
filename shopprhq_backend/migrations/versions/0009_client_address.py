"""Add address field to clients

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-27

Changes:
  clients — address (nullable text, single free-text field for store address)
"""

from alembic import op
import sqlalchemy as sa

revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'clients',
        sa.Column(
            'address',
            sa.String(),
            nullable=True,
            comment='Store address shown on PDF receipts e.g. "14 Rumuola Road, Port Harcourt"',
        ),
    )


def downgrade() -> None:
    op.drop_column('clients', 'address')
