"""Initial schema — clean baseline from all models

Revision ID: 0001_initial
Revises: 
Create Date: 2025-01-01 00:00:00.000000

This replaces all previous migrations with a single clean baseline.
Run after wiping the database:
  python reset_db.py   (drops everything)
  alembic upgrade head (recreates from scratch)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── ENUMS (IF NOT EXISTS — safe to re-run) ───────────────────────────────
    # Use raw SQL so we never conflict with leftover types from previous deploys.
    # create_type=False on every column below prevents SQLAlchemy auto-creating them.

    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
                CREATE TYPE order_status AS ENUM (
                    'CREATED', 'PENDING_PAYMENT', 'PAID',
                    'AWAITING_PICKUP', 'FULFILLED', 'CANCELLED', 'REFUNDED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'paymentstatus') THEN
                CREATE TYPE paymentstatus AS ENUM (
                    'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'whatsapp_message_direction') THEN
                CREATE TYPE whatsapp_message_direction AS ENUM (
                    'incoming', 'outgoing'
                );
            END IF;
        END
        $$;
    """)

    # ── merchants ─────────────────────────────────────────────────────────────

    op.create_table(
        'merchants',
        sa.Column('id', sa.String(6), primary_key=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('failed_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # ── clients ───────────────────────────────────────────────────────────────

    op.create_table(
        'clients',
        sa.Column('id', sa.String(6), primary_key=True, index=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('whatsapp_number', sa.String(20), nullable=False),
        sa.Column('store_contact_number', sa.String(20), nullable=False),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # ── client_whatsapp_credentials ───────────────────────────────────────────

    op.create_table(
        'client_whatsapp_credentials',
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  primary_key=True, index=True),
        sa.Column('phone_number_id', sa.String(255), nullable=False,
                  unique=True, index=True),
        sa.Column('whatsapp_number', sa.String(20), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true'), index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # ── products ──────────────────────────────────────────────────────────────

    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('price', sa.Float(), nullable=True),
    )

    # ── inventories ───────────────────────────────────────────────────────────

    op.create_table(
        'inventories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('product_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('unit_price', sa.Float(), nullable=True),
        sa.Column('warehouse_location', sa.String(255), nullable=True),
        sa.UniqueConstraint('product_id', 'merchant_id', 'client_id',
                            name='uq_inventory_per_tenant_product'),
    )
    op.create_index('ix_inventory_tenant_product', 'inventories',
                    ['merchant_id', 'client_id', 'product_id'])

    # ── carts ─────────────────────────────────────────────────────────────────

    op.create_table(
        'carts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('user_id', sa.String(), nullable=False, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('checked_out', sa.Boolean(), nullable=False,
                  server_default=sa.text('false'), index=True),
        sa.Column('checked_out_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('merchant_id', 'client_id', 'user_id', 'checked_out',
                            name='uq_active_cart_per_user'),
    )
    op.create_index('ix_carts_merchant_client_user', 'carts',
                    ['merchant_id', 'client_id', 'user_id'])
    op.create_index('ix_carts_user_created', 'carts', ['user_id', 'created_at'])

    # ── cart_items ────────────────────────────────────────────────────────────

    op.create_table(
        'cart_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('cart_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('carts.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('product_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('products.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('price_at_add', sa.Float(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.UniqueConstraint('cart_id', 'product_id', name='uq_cart_product'),
    )
    op.create_index('ix_cart_items_cart_created', 'cart_items',
                    ['cart_id', 'created_at'])

    # ── orders ────────────────────────────────────────────────────────────────

    op.create_table(
        'orders',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('order_code', sa.String(8), nullable=False, unique=True, index=True),
        sa.Column('cart_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('carts.id', ondelete='RESTRICT'),
                  nullable=False, index=True, unique=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('user_id', sa.String(), nullable=False, index=True),
        sa.Column('customer_name', sa.String(), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=False),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('status', sa.Enum(
            'CREATED', 'PENDING_PAYMENT', 'PAID',
            'AWAITING_PICKUP', 'FULFILLED', 'CANCELLED', 'REFUNDED',
            name='order_status', create_type=False,
        ), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('confirmed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('fulfilled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pickup_location', sa.String(), nullable=True),
        sa.Column('payment_metadata', postgresql.JSON(), nullable=True),
        sa.Column('confirm_whatsapp_number', sa.String(20), nullable=True),
        sa.UniqueConstraint('cart_id', name='uq_order_per_cart'),
        sa.Index('ix_orders_merchant_client', 'merchant_id', 'client_id'),
        sa.Index('ix_orders_user_status', 'user_id', 'status'),
        sa.Index('ix_orders_merchant_status', 'merchant_id', 'status'),
        sa.Index('ix_orders_created_at', 'created_at'),
        sa.Index('ix_orders_order_code_lookup', 'order_code', 'merchant_id'),
    )

    # ── payments ──────────────────────────────────────────────────────────────

    op.create_table(
        'payments',
        sa.Column('id', sa.String(36), primary_key=True, index=True),
        sa.Column('order_id', sa.String(36),
                  sa.ForeignKey('orders.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('method', sa.String(50), nullable=False),
        sa.Column('status', sa.Enum(
            'PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED',
            name='paymentstatus', create_type=False,
        ), nullable=False),
        sa.Column('external_reference', sa.String(), nullable=True, index=True),
        sa.Column('payment_metadata', postgresql.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.UniqueConstraint('order_id', name='uq_payment_per_order'),
    )
    op.create_index('ix_payment_merchant_client', 'payments',
                    ['merchant_id', 'client_id'])

    # ── flutterwave_subaccounts ───────────────────────────────────────────────

    op.create_table(
        'flutterwave_subaccounts',
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  primary_key=True, index=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('subaccount_id', sa.String(100), nullable=False, unique=True),
        sa.Column('account_bank', sa.String(10), nullable=False),
        sa.Column('account_number', sa.String(20), nullable=False),
        sa.Column('business_name', sa.String(255), nullable=False),
        sa.Column('split_value', sa.String(10), nullable=True),
        sa.Column('split_type', sa.String(20), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # ── idempotency_keys ──────────────────────────────────────────────────────

    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('merchant_id', sa.String(6), nullable=False, index=True),
        sa.Column('key', sa.String(), nullable=False, index=True),
        sa.Column('request_hash', sa.String(), nullable=True),
        sa.Column('response_data', postgresql.JSON(), nullable=True),
        sa.Column('response_status', sa.Integer(), nullable=True),
        sa.Column('response_headers', postgresql.JSON(), nullable=True),
        sa.Column('is_processing', sa.Boolean(), nullable=False,
                  server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('merchant_id', 'key',
                            name='uq_idempotency_merchant_key'),
    )
    op.create_index('ix_idempotency_merchant_key_expires', 'idempotency_keys',
                    ['merchant_id', 'key', 'expires_at'])

    # ── human_agent_tasks ─────────────────────────────────────────────────────

    op.create_table(
        'human_agent_tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('cart_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('carts.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('status', sa.String(), nullable=True, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # ── clarifications ────────────────────────────────────────────────────────

    op.create_table(
        'clarifications',
        sa.Column('id', sa.String(36), primary_key=True, index=True),
        sa.Column('merchant_id', sa.String(6),
                  sa.ForeignKey('merchants.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('client_id', sa.String(6),
                  sa.ForeignKey('clients.id', ondelete='CASCADE'),
                  nullable=True),
        sa.Column('session_id', sa.String(), nullable=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('resolved', sa.Boolean(), nullable=False,
                  server_default=sa.text('false')),
        sa.Column('resolution', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )

    # ── whatsapp_message_logs ─────────────────────────────────────────────────

    op.create_table(
        'whatsapp_message_logs',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('merchant_id', sa.String(), nullable=False),
        sa.Column('client_id', sa.String(), nullable=True),
        sa.Column('from_number', sa.String(), nullable=False),
        sa.Column('to_number', sa.String(), nullable=True),
        sa.Column('direction', sa.Enum(
            'incoming', 'outgoing',
            name='whatsapp_message_direction', create_type=False,
        ), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('meta', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True,
                  server_default=sa.text('now()')),
    )

    # ── pg_trgm extension (required for fuzzy product search) ─────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')


def downgrade() -> None:
    op.drop_table('whatsapp_message_logs')
    op.drop_table('clarifications')
    op.drop_table('human_agent_tasks')
    op.drop_table('idempotency_keys')
    op.drop_table('flutterwave_subaccounts')
    op.drop_table('payments')
    op.drop_table('orders')
    op.drop_table('cart_items')
    op.drop_table('carts')
    op.drop_table('inventories')
    op.drop_table('products')
    op.drop_table('client_whatsapp_credentials')
    op.drop_table('clients')
    op.drop_table('merchants')

    op.execute("DROP TYPE IF EXISTS order_status")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
    op.execute("DROP TYPE IF EXISTS whatsapp_message_direction")
