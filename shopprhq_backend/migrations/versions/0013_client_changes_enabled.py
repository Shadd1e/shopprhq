"""Add client_changes_enabled to clients table

Revision ID: 0013
Revises: 0012
Create Date: 2026-04-03

Changes:
  clients.client_changes_enabled  BOOLEAN NOT NULL DEFAULT false
      When true, the store dashboard can edit delivery and persona settings.
      Controlled by the merchant. Defaults off.
"""

from alembic import op
import sqlalchemy as sa


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column(
            "client_changes_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("clients", "client_changes_enabled")
