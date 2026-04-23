"""Drop uq_active_cart_per_user constraint — it blocks repeat orders

Revision ID: 0003_drop_uq_active_cart_per_user
Revises: 0002_operator_notify_low_stock
Create Date: 2026-03-19 10:00:00.000000

The constraint (merchant_id, client_id, user_id, checked_out) incorrectly
prevents a user from having more than one checked-out cart, which breaks
every order after the first.
"""

from alembic import op
from sqlalchemy import inspect

revision = '0003_drop_uq_active_cart'
down_revision = '0002_operator_notify_low_stock'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    constraints = [c['name'] for c in inspector.get_unique_constraints('carts')]
    if 'uq_active_cart_per_user' in constraints:
        op.drop_constraint('uq_active_cart_per_user', 'carts', type_='unique')


def downgrade() -> None:
    # Do not restore — this constraint was always wrong
    pass
