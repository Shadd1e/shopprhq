"""Add store hours fields to clients table

Revision ID: 0012
Revises: 0011
Create Date: 2026-04-02

Changes:
  clients.opens_at    VARCHAR(5) nullable
      Store opening time in 24hr HH:MM format e.g. "09:00".
      Null means the store is always open.

  clients.closes_at   VARCHAR(5) nullable
      Store closing time in 24hr HH:MM format e.g. "21:00".
      Null means the store is always open.

  clients.store_timezone  VARCHAR(50) nullable, default 'Africa/Lagos'
      IANA timezone string for evaluating opening hours in local time.
"""

from alembic import op
import sqlalchemy as sa


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("opens_at", sa.String(length=5), nullable=True))
    op.add_column("clients", sa.Column("closes_at", sa.String(length=5), nullable=True))
    op.add_column(
        "clients",
        sa.Column(
            "store_timezone",
            sa.String(length=50),
            nullable=True,
            server_default=sa.text("'Africa/Lagos'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("clients", "store_timezone")
    op.drop_column("clients", "closes_at")
    op.drop_column("clients", "opens_at")
