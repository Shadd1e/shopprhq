"""add last_order fields to customer_profiles

Revision ID: 0014_customer_last_order
Revises: 0013
Create Date: 2026-04-04

Two new nullable columns on customer_profiles:
  last_order_summary     TEXT   — JSON blob of the customer's last completed order
  last_order_client_id   VARCHAR(6) — which store that order belongs to

Used to offer a one-tap repeat-order prompt on the customer's next visit.
Safe to deploy with zero downtime — both columns are nullable with no default.
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_customer_last_order"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "customer_profiles",
        sa.Column("last_order_summary", sa.Text(), nullable=True),
    )
    op.add_column(
        "customer_profiles",
        sa.Column(
            "last_order_client_id",
            sa.String(length=6),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("customer_profiles", "last_order_client_id")
    op.drop_column("customer_profiles", "last_order_summary")
