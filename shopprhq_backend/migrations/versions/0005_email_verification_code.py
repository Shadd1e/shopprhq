"""change email_verification_token to 6-digit code with expiry

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reuse the existing column — just widen it (it was String(64), codes are 6 chars, fine as-is)
    # Add expiry column
    op.add_column('merchants', sa.Column(
        'email_verification_token_expiry',
        sa.DateTime(timezone=True),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('merchants', 'email_verification_token_expiry')
