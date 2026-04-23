"""Add operator_notify_phone to clients and low_stock_threshold to inventories

Revision ID: 0002_operator_notify_low_stock
Revises: 0001_initial
Create Date: 2026-03-18 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0002_operator_notify_low_stock'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    """Check if a column already exists — safe for concurrent/repeated runs."""
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns(table)]
    return column in cols


def upgrade() -> None:

    # Add operator_notify_phone to clients
    if not _column_exists("clients", "operator_notify_phone"):
        op.add_column(
            "clients",
            sa.Column(
                "operator_notify_phone",
                sa.String(20),
                nullable=True,
            )
        )

    # Add low_stock_threshold to inventories
    if not _column_exists("inventories", "low_stock_threshold"):
        op.add_column(
            "inventories",
            sa.Column(
                "low_stock_threshold",
                sa.Integer(),
                nullable=True,
            )
        )


def downgrade() -> None:
    if _column_exists("inventories", "low_stock_threshold"):
        op.drop_column("inventories", "low_stock_threshold")
    if _column_exists("clients", "operator_notify_phone"):
        op.drop_column("clients", "operator_notify_phone")
