"""
Ordaa Test Suite — conftest.py
Shared fixtures, mocks, and test helpers.
"""

import pytest
import asyncio
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from typing import AsyncGenerator

# ─── Async test event loop ─────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ─── Tenant / Context fixtures ─────────────────────────────────────────────────
@pytest.fixture
def merchant_id():
    return "MERCH1"

@pytest.fixture
def client_id():
    return "CLNT01"

@pytest.fixture
def user_phone():
    return "2348012345678"

@pytest.fixture
def phone_number_id():
    return "12345678901"

@pytest.fixture
def tenant_context(merchant_id, client_id, phone_number_id):
    from app.core.tenant_context import TenantContext
    return TenantContext(
        merchant_id=merchant_id,
        client_id=client_id,
        phone_number_id=phone_number_id,
    )


# ─── Mock DB Session ───────────────────────────────────────────────────────────
@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.flush = AsyncMock()
    db.commit = AsyncMock()
    db.rollback = AsyncMock()
    db.add = MagicMock()
    db.delete = AsyncMock()
    db.begin = MagicMock(return_value=AsyncMock(__aenter__=AsyncMock(), __aexit__=AsyncMock()))
    db.run_sync = AsyncMock()
    return db


# ─── Mock Redis / Memory ───────────────────────────────────────────────────────
@pytest.fixture
def mock_memory():
    memory = AsyncMock()
    memory.get_mode = AsyncMock(return_value="idle")
    memory.set_mode = AsyncMock()
    memory.get_choices = AsyncMock(return_value=[])
    memory.set_choices = AsyncMock()
    memory.clear_choices = AsyncMock()
    memory.get_customer_name = AsyncMock(return_value=None)
    memory.set_customer_name = AsyncMock()
    memory.get_last_search = AsyncMock(return_value=None)
    memory.set_last_search = AsyncMock()
    memory.get = AsyncMock(return_value=None)
    memory.set = AsyncMock()
    memory.add_user = AsyncMock()
    memory.add_assistant = AsyncMock()
    memory.clear = AsyncMock()
    return memory


# ─── Product / Cart helpers ────────────────────────────────────────────────────
@pytest.fixture
def product_id():
    return str(uuid.uuid4())

@pytest.fixture
def cart_id():
    return str(uuid.uuid4())

@pytest.fixture
def order_id():
    return str(uuid.uuid4())

@pytest.fixture
def tx_ref(order_id):
    return f"order_{order_id}"

def make_product(merchant_id, client_id, name="Jollof Rice", price=1500.0, product_id=None):
    p = MagicMock()
    p.id = product_id or str(uuid.uuid4())
    p.merchant_id = merchant_id
    p.client_id = client_id
    p.name = name
    p.price = price
    p.description = "Delicious"
    inv = MagicMock()
    inv.quantity = 10
    p.inventory = inv
    return p

def make_cart(merchant_id, client_id, user_id, cart_id=None, checked_out=False, items=None):
    c = MagicMock()
    c.id = cart_id or str(uuid.uuid4())
    c.merchant_id = merchant_id
    c.client_id = client_id
    c.user_id = user_id
    c.checked_out = checked_out
    c.checked_out_at = None
    c.items = items or []
    return c

def make_cart_item(product, quantity=1, price=None):
    item = MagicMock()
    item.id = str(uuid.uuid4())
    item.product_id = product.id
    item.product = product
    item.quantity = quantity
    item.price_at_add = price or product.price
    return item

def make_order(merchant_id, client_id, user_id, order_id=None, cart_id=None, status="PENDING_PAYMENT", payment_method="card"):
    from unittest.mock import MagicMock
    o = MagicMock()
    o.id = order_id or str(uuid.uuid4())
    o.merchant_id = merchant_id
    o.client_id = client_id
    o.user_id = user_id
    o.cart_id = cart_id or str(uuid.uuid4())
    o.order_code = "ABC12345"
    o.status = status
    o.payment_method = payment_method
    o.total_amount = 3000.0
    o.confirmed_at = None
    return o
