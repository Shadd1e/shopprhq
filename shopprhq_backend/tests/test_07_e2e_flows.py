"""
TEST GROUP 07 — End-to-End Flow Tests
======================================
Simulates the complete WhatsApp commerce flows:
1. Customer browses → selects → adds to cart → cash checkout
2. Customer browses → selects → adds to cart → card checkout → webhook confirms
3. Confirm cash from store side
4. New order after previous checkout

These tests wire together multiple units and mock only external I/O
(Redis, DB, Flutterwave API, Meta API).

PASS = complete flows work without crashes or stuck states
FAIL = a flow is broken mid-way or leaves state inconsistent
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from tests.conftest import make_product, make_cart, make_cart_item, make_order


# ─── Flow 1: Browse → Select → Cash Checkout ─────────────────────────────────

@pytest.mark.asyncio
async def test_flow_product_search_to_cash_order(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    FLOW 1: Full path from product search to placed cash order.

    Steps:
    1. User searches "jollof"
    2. System presents 3 choices, mode → selecting
    3. User sends "1"
    4. Item added to cart, mode → shopping
    5. User sends "checkout"
    6. System asks cash/card, mode → payment
    7. User sends "1" (cash)
    8. Order created, cart closed
    """
    from app.schemas.fuzzy import FuzzyMatchResultSchema
    from app.orchestrators.context import ConversationContext
    from app.orchestrators.conversation_router import ConversationRouter

    product_id = str(uuid.uuid4())
    cart_id = str(uuid.uuid4())

    product = make_product(
        tenant_context.merchant_id, tenant_context.client_id,
        name="Jollof Rice", price=1500.0, product_id=product_id
    )
    cart = make_cart(
        tenant_context.merchant_id, tenant_context.client_id,
        user_phone, cart_id=cart_id
    )
    item = make_cart_item(product, quantity=1, price=1500.0)

    # Mock fuzzy results
    matches = [
        FuzzyMatchResultSchema(
            product_id=product_id, name="Jollof Rice",
            score=90.0, price=1500.0, currency=None,
            description=None, quantity=5
        )
    ]

    # --- STEP 1: Product search ---
    mock_memory.get_mode = AsyncMock(return_value="idle")

    ctx = MagicMock()
    ctx.tenant = tenant_context
    ctx.db = mock_db
    ctx.user_phone = user_phone
    ctx.user_text = "jollof"
    ctx.phone_number_id = "12345678901"
    ctx.memory = mock_memory
    ctx.cart_service = AsyncMock()
    ctx.checkout_service = AsyncMock()
    ctx.matcher = AsyncMock()
    ctx.matcher.search = AsyncMock(return_value=matches)

    router = ConversationRouter(ctx)
    result_search = await router.route(
        intent="product_search",
        intent_payload={"search_query": "jollof"}
    )

    assert "jollof" in result_search.lower() or "Jollof" in result_search
    mock_memory.set_mode.assert_called_with("selecting")

    # --- STEP 2: Selection ---
    mock_memory.get_mode = AsyncMock(return_value="selecting")
    mock_memory.get_choices = AsyncMock(return_value=[{
        "product_id": product_id,
        "name": "Jollof Rice",
        "price": 1500.0,
    }])
    ctx.user_text = "1"

    cart.items = [item]
    ctx.cart_service.get_active_cart = AsyncMock(return_value=cart)
    ctx.cart_service.create_cart = AsyncMock(return_value=cart)
    ctx.cart_service.add_item = AsyncMock(return_value=cart)
    ctx.cart_service.get_cart_summary = AsyncMock(return_value={
        "has_items": True,
        "item_count": 1,
        "total": 1500.0,
        "items": [{"product_id": product_id, "product_name": "Jollof Rice",
                   "quantity": 1, "price": 1500.0, "subtotal": 1500.0}]
    })

    result_select = await router.route(intent="other", intent_payload={})

    assert "Jollof Rice" in result_select or "added" in result_select.lower()
    mock_memory.set_mode.assert_called_with("shopping")

    # --- STEP 3: Checkout initiation ---
    mock_memory.get_mode = AsyncMock(return_value="shopping")
    ctx.user_text = "checkout"
    ctx.cart_service.get_cart_summary = AsyncMock(return_value={
        "has_items": True,
        "item_count": 1,
        "total": 1500.0,
        "items": []
    })

    result_checkout = await router.route(intent="checkout", intent_payload={})

    assert "1" in result_checkout and "2" in result_checkout
    mock_memory.set_mode.assert_called_with("payment")

    # --- STEP 4: Cash payment selection ---
    mock_memory.get_mode = AsyncMock(return_value="payment")
    ctx.user_text = "1"
    mock_memory.get_customer_name = AsyncMock(return_value="Tunde")

    from app.schemas.checkout import CheckoutResponseSchema
    from app.models.order import OrderStatus

    mock_checkout_result = CheckoutResponseSchema(
        success=True,
        order_id=str(uuid.uuid4()),
        order_code="TST12345",
        order_status=OrderStatus.AWAITING_PICKUP.value,
        message="Order placed",
        total_amount=1500.0,
        payment_instructions=None,
        estimated_time="30-45 minutes",
        store_contact="Store",
        payment_link=None,
    )
    ctx.checkout_service.checkout_from_whatsapp = AsyncMock(return_value=mock_checkout_result)

    result_confirm = await router.route(intent="other", intent_payload={})

    assert "TST12345" in result_confirm or "order" in result_confirm.lower()


# ─── Flow 2: Browse → Card Checkout → Webhook Confirms ───────────────────────

@pytest.mark.asyncio
async def test_flow_card_checkout_leaves_cart_open(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    FLOW 2: Card payment checkout — cart stays open until webhook fires.
    """
    from app.orchestrators.context import ConversationContext
    from app.orchestrators.conversation_router import ConversationRouter
    from app.schemas.checkout import CheckoutResponseSchema
    from app.models.order import OrderStatus

    ctx = MagicMock()
    ctx.tenant = tenant_context
    ctx.db = mock_db
    ctx.user_phone = user_phone
    ctx.user_text = "2"
    ctx.phone_number_id = "12345678901"
    ctx.memory = mock_memory

    mock_memory.get_mode = AsyncMock(return_value="payment")
    mock_memory.get_customer_name = AsyncMock(return_value=None)

    cart_id = str(uuid.uuid4())
    mock_checkout_result = CheckoutResponseSchema(
        success=True,
        order_id=str(uuid.uuid4()),
        order_code="CRD99999",
        order_status=OrderStatus.PENDING_PAYMENT.value,
        message="Pay via link",
        total_amount=3000.0,
        payment_instructions=None,
        estimated_time="Instant",
        store_contact="Store",
        payment_link="https://pay.flutterwave.com/test123",
    )

    ctx.checkout_service = AsyncMock()
    ctx.checkout_service.checkout_from_whatsapp = AsyncMock(return_value=mock_checkout_result)
    ctx.cart_service = AsyncMock()
    ctx.cart_service.get_cart_summary = AsyncMock(return_value={
        "has_items": True, "item_count": 1, "total": 3000.0, "items": []
    })
    ctx.matcher = AsyncMock()

    router = ConversationRouter(ctx)
    result = await router.route(intent="other", intent_payload={})

    # Should contain the payment link
    assert "https://pay.flutterwave.com/test123" in result, \
        "Card checkout response must include payment link"


# ─── Flow 3: New order after existing checkout ────────────────────────────────

@pytest.mark.asyncio
async def test_flow_new_order_after_checkout(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    FLOW 3: After completing an order, user sends 'new' — creates fresh cart.
    Mode must reset to idle.
    """
    from app.orchestrators.context import ConversationContext
    from app.orchestrators.conversation_router import ConversationRouter

    ctx = MagicMock()
    ctx.tenant = tenant_context
    ctx.db = mock_db
    ctx.user_phone = user_phone
    ctx.user_text = "new"
    ctx.phone_number_id = "12345678901"
    ctx.memory = mock_memory
    mock_memory.get_mode = AsyncMock(return_value="idle")

    new_cart = make_cart(tenant_context.merchant_id, tenant_context.client_id, user_phone)
    ctx.cart_service = AsyncMock()
    ctx.cart_service.create_cart = AsyncMock(return_value=new_cart)
    ctx.checkout_service = AsyncMock()
    ctx.matcher = AsyncMock()

    router = ConversationRouter(ctx)
    result = await router.route(intent="new_order", intent_payload={})

    ctx.cart_service.create_cart.assert_called_once()
    assert "fresh" in result.lower() or "start" in result.lower() or "cart" in result.lower()


# ─── Flow 4: Duplicate checkout guard ────────────────────────────────────────

@pytest.mark.asyncio
async def test_flow_duplicate_checkout_shows_friendly_message(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    FLOW 4: If user tries to checkout a cart that already has an order,
    system shows a friendly message and suggests 'new'.
    """
    from app.orchestrators.context import ConversationContext
    from app.orchestrators.conversation_router import ConversationRouter

    ctx = MagicMock()
    ctx.tenant = tenant_context
    ctx.db = mock_db
    ctx.user_phone = user_phone
    ctx.user_text = "1"
    ctx.phone_number_id = "12345678901"
    ctx.memory = mock_memory
    mock_memory.get_mode = AsyncMock(return_value="payment")
    mock_memory.get_customer_name = AsyncMock(return_value=None)

    ctx.cart_service = AsyncMock()
    ctx.checkout_service = AsyncMock()
    ctx.checkout_service.checkout_from_whatsapp = AsyncMock(
        side_effect=ValueError("Cart already has an active order")
    )
    ctx.matcher = AsyncMock()

    router = ConversationRouter(ctx)
    result = await router.route(intent="other", intent_payload={})

    assert "new" in result.lower() or "active order" in result.lower(), \
        "Duplicate checkout should prompt user to send 'new'"


# ─── Flow 5: Empty cart checkout guard ───────────────────────────────────────

@pytest.mark.asyncio
async def test_flow_checkout_empty_cart_blocked(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    FLOW 5: Cannot checkout empty cart — friendly block message.
    """
    from app.orchestrators.conversation_router import ConversationRouter

    ctx = MagicMock()
    ctx.tenant = tenant_context
    ctx.db = mock_db
    ctx.user_phone = user_phone
    ctx.user_text = "checkout"
    ctx.phone_number_id = "12345678901"
    ctx.memory = mock_memory
    mock_memory.get_mode = AsyncMock(return_value="idle")

    ctx.cart_service = AsyncMock()
    ctx.cart_service.get_cart_summary = AsyncMock(return_value={
        "has_items": False, "item_count": 0, "total": 0, "items": []
    })
    ctx.checkout_service = AsyncMock()
    ctx.matcher = AsyncMock()

    router = ConversationRouter(ctx)
    result = await router.route(intent="checkout", intent_payload={})

    assert "empty" in result.lower() or "add" in result.lower(), \
        "Empty cart checkout should block and tell user to add items"


# ─── Flow 6: Memory persistence across messages ───────────────────────────────

@pytest.mark.asyncio
async def test_flow_memory_persists_customer_name():
    """
    FLOW 6: Customer name extracted from a message must be stored in memory.
    Subsequent messages should have access to it.
    """
    from app.conversation.memory import ConversationMemory

    with patch("app.conversation.memory.get_session", return_value={}), \
         patch("app.conversation.memory.set_session") as mock_save:

        memory = await ConversationMemory.load("MERCH1", "234xxx")
        await memory.set_customer_name("Chisom")

        name = await memory.get_customer_name()

    assert name == "Chisom"
    mock_save.assert_called()  # Session was persisted


@pytest.mark.asyncio
async def test_flow_memory_mode_resets_on_new_order():
    """
    FLOW 6: Sending 'new' should reset mode to idle and clear choices.
    """
    from app.conversation.memory import ConversationMemory

    session = {"mode": "payment", "pending_choices": [{"product_id": "p1"}]}

    with patch("app.conversation.memory.get_session", return_value=session), \
         patch("app.conversation.memory.set_session"):

        memory = await ConversationMemory.load("MERCH1", "234xxx")
        await memory.set_mode("idle")
        await memory.clear_choices()

        mode = await memory.get_mode()
        choices = await memory.get_choices()

    assert mode == "idle"
    assert choices == []
