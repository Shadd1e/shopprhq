"""Add delivery, assistant persona, product images/variants, customer profiles

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-26

Changes:
  clients     — delivery_enabled, delivery_fee, assistant_name, assistant_personality
  orders      — delivery_type, delivery_address, delivery_contact_number, delivery_fee
  order_status — add OUT_FOR_DELIVERY value
  products    — image_url, variant_group
  NEW TABLE   — customer_profiles (phone_number, name, created_at, last_seen_at)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── 1. Add OUT_FOR_DELIVERY to order_status enum ───────────────────────────
    # PostgreSQL requires ALTER TYPE to add enum values.
    # IF NOT EXISTS guard prevents failure on re-run.
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'OUT_FOR_DELIVERY'
                AND enumtypid = (
                    SELECT oid FROM pg_type WHERE typname = 'order_status'
                )
            ) THEN
                ALTER TYPE order_status ADD VALUE 'OUT_FOR_DELIVERY'
                AFTER 'PAID';
            END IF;
        END
        $$;
    """)

    # ── 2. Add delivery_type enum ─────────────────────────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverytype') THEN
                CREATE TYPE deliverytype AS ENUM ('pickup', 'delivery');
            END IF;
        END
        $$;
    """)

    # ── 3. clients — delivery + assistant persona columns ────────────────────
    op.add_column('clients',
        sa.Column(
            'delivery_enabled',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
            comment='Whether this store offers delivery to customers',
        )
    )
    op.add_column('clients',
        sa.Column(
            'delivery_fee',
            sa.Numeric(10, 2),
            nullable=True,
            comment='Flat delivery fee charged per order when delivery_enabled is true',
        )
    )
    op.add_column('clients',
        sa.Column(
            'assistant_name',
            sa.String(80),
            nullable=True,
            comment='Custom name for the WhatsApp assistant persona (e.g. Amara)',
        )
    )
    op.add_column('clients',
        sa.Column(
            'assistant_personality',
            sa.String(30),
            nullable=True,
            comment='Personality style: friendly_casual | professional | warm_enthusiastic',
        )
    )

    # ── 4. orders — delivery columns ──────────────────────────────────────────
    op.add_column('orders',
        sa.Column(
            'delivery_type',
            sa.Enum(
                'pickup',
                'delivery',
                name='deliverytype',
                create_type=False,   # already created above
            ),
            nullable=True,
            comment='pickup = customer collects; delivery = rider brings to address',
        )
    )
    op.add_column('orders',
        sa.Column(
            'delivery_address',
            sa.Text(),
            nullable=True,
            comment='Full delivery address as provided by customer, including landmark',
        )
    )
    op.add_column('orders',
        sa.Column(
            'delivery_contact_number',
            sa.String(20),
            nullable=True,
            comment='Phone number for delivery contact — may differ from WhatsApp number',
        )
    )
    op.add_column('orders',
        sa.Column(
            'delivery_fee',
            sa.Numeric(10, 2),
            nullable=True,
            comment='Delivery fee captured at time of order placement',
        )
    )

    # Create index for common query: all delivery orders for a merchant
    op.create_index(
        'ix_orders_delivery_type',
        'orders',
        ['merchant_id', 'delivery_type'],
    )

    # ── 5. products — image_url + variant_group ───────────────────────────────
    op.add_column('products',
        sa.Column(
            'image_url',
            sa.String(500),
            nullable=True,
            comment='Publicly accessible image URL (Cloudinary recommended)',
        )
    )
    op.add_column('products',
        sa.Column(
            'variant_group',
            sa.String(100),
            nullable=True,
            comment='Groups products into a family e.g. "noodles", "water". '
                    'When a customer asks for the group name, all variants are listed.',
        )
    )

    # Index so variant lookups are fast
    op.create_index(
        'ix_products_variant_group',
        'products',
        ['client_id', 'variant_group'],
    )

    # ── 6. customer_profiles — new table ─────────────────────────────────────
    op.create_table(
        'customer_profiles',

        # phone_number is the natural PK — it IS the customer identity
        sa.Column(
            'phone_number',
            sa.String(20),
            primary_key=True,
            comment='WhatsApp number without leading + e.g. 2348012345678',
        ),

        sa.Column(
            'name',
            sa.String(100),
            nullable=True,
            comment='Name as provided by the customer on first contact',
        ),

        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
            comment='When this profile was first created (first ever message)',
        ),

        sa.Column(
            'last_seen_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text('now()'),
            comment='Updated on every inbound message from this customer',
        ),
    )


def downgrade() -> None:
    # ── Drop customer_profiles ────────────────────────────────────────────────
    op.drop_table('customer_profiles')

    # ── Drop product columns ──────────────────────────────────────────────────
    op.drop_index('ix_products_variant_group', table_name='products')
    op.drop_column('products', 'variant_group')
    op.drop_column('products', 'image_url')

    # ── Drop order columns ────────────────────────────────────────────────────
    op.drop_index('ix_orders_delivery_type', table_name='orders')
    op.drop_column('orders', 'delivery_fee')
    op.drop_column('orders', 'delivery_contact_number')
    op.drop_column('orders', 'delivery_address')
    op.drop_column('orders', 'delivery_type')

    # ── Drop client columns ───────────────────────────────────────────────────
    op.drop_column('clients', 'assistant_personality')
    op.drop_column('clients', 'assistant_name')
    op.drop_column('clients', 'delivery_fee')
    op.drop_column('clients', 'delivery_enabled')

    # ── Drop deliverytype enum ────────────────────────────────────────────────
    op.execute("DROP TYPE IF EXISTS deliverytype;")

    # NOTE: Removing OUT_FOR_DELIVERY from the order_status enum is not supported
    # in PostgreSQL without recreating the type. On downgrade, the value is left
    # in the enum but is no longer used. This is safe — unused enum values
    # cause no harm. If a full rollback is needed, reset_db.py + 0001 is cleaner.
