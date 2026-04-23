"""add email_verified, email_verification_token, waba_active to merchants

Revision ID: 0004
Revises: 0003_drop_uq_active_cart
Create Date: 2026-03-20
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003_drop_uq_active_cart'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('merchants', sa.Column(
        'email_verified', sa.Boolean(), nullable=False, server_default='false'
    ))
    op.add_column('merchants', sa.Column(
        'email_verification_token', sa.String(64), nullable=True
    ))
    op.add_column('merchants', sa.Column(
        'waba_active', sa.Boolean(), nullable=False, server_default='false'
    ))


def downgrade() -> None:
    op.drop_column('merchants', 'waba_active')
    op.drop_column('merchants', 'email_verification_token')
    op.drop_column('merchants', 'email_verified')
