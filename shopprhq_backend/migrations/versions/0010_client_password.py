"""Add password_hash to clients for store-scoped login

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-28

Changes:
  clients — password_hash (nullable VARCHAR 255, Argon2 hash set by merchant)
"""

from alembic import op
import sqlalchemy as sa

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'clients',
        sa.Column(
            'password_hash',
            sa.String(255),
            nullable=True,
            comment='Argon2 hash of the store dashboard password set by the merchant. '
                    'Null = no login configured yet.',
        ),
    )


def downgrade() -> None:
    op.drop_column('clients', 'password_hash')
