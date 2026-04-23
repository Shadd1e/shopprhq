"""Add onboarding status to client_whatsapp_credentials and whatsapp_number to merchants

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-29

Changes:
  client_whatsapp_credentials — status VARCHAR(20) NOT NULL DEFAULT 'pending'
      Values: pending | otp_sent | otp_verified | active
      Replaces the boolean-only active flag as the source of truth for
      onboarding progress. The active column is kept for backwards compat
      but is now derived: active=True only when status='active'.

  merchants — whatsapp_number VARCHAR(20) nullable
      Captures the number the merchant wants to use, submitted at
      registration. Stored here so the admin dashboard can read it
      without joining through clients.
"""

from alembic import op
import sqlalchemy as sa

revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -- client_whatsapp_credentials: add status column ------------------
    op.add_column(
        'client_whatsapp_credentials',
        sa.Column(
            'status',
            sa.String(length=20),
            nullable=False,
            server_default='pending',
            comment=(
                'Onboarding state machine: '
                'pending | otp_sent | otp_verified | active'
            ),
        ),
    )

    # Back-fill: any row that was already active=True is fully live
    op.execute(
        """
        UPDATE client_whatsapp_credentials
        SET    status = 'active'
        WHERE  active = TRUE
        """
    )

    # -- merchants: add whatsapp_number column ----------------------------
    op.add_column(
        'merchants',
        sa.Column(
            'whatsapp_number',
            sa.String(length=20),
            nullable=True,
            comment='WhatsApp number submitted at registration (no + prefix)',
        ),
    )


def downgrade() -> None:
    op.drop_column('client_whatsapp_credentials', 'status')
    op.drop_column('merchants', 'whatsapp_number')
