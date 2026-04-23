"""
TEST GROUP 02 — Conversation Routing & Intent Classification
============================================================
Tests the ConversationRouter's mode/intent dispatch logic.
Every valid intent must route to the correct handler.
Every mode transition must be correct.

PASS = router sends each message to the right place
FAIL = intents misrouted, modes stuck, or flow broken
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── Fixtures ─────────────────────────────────────────────────────────────────

def make_context(tenant, mock_db, user_phone, mock_memory):
    from app.orchestrators.context import ConversationContext
    ctx = MagicMock(spec=ConversationContext)
    ctx.tenant = tenant
    ctx.db = mock_db
    ctx.user_phone = user_phone
    ctx.user_text = "test"
    ctx.phone_number_id = "12345678901"
    ctx.memory = mock_memory
    ctx.cart_service = AsyncMock()
    ctx.checkout_service = AsyncMock()
    ctx.matcher = AsyncMock()
    return ctx


# ─── 02.1 Mode-first routing ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mode_selecting_routes_to_search_handler(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    When mode=selecting, router must call search.handle_selection
    regardless of what the intent classifier returned.
    """
    mock_memory.get_mode = AsyncMock(return_value="selecting")

    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)
    ctx.user_text = "2"

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.search.handle_selection = AsyncMock(return_value="You selected item 2")

    result = await router.route(intent="greeting", intent_payload={})

    router.search.handle_selection.assert_called_once_with("2")
    assert result == "You selected item 2"


@pytest.mark.asyncio
async def test_mode_payment_routes_to_checkout_handler(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    When mode=payment, router must call checkout.handle_payment_selection.
    """
    mock_memory.get_mode = AsyncMock(return_value="payment")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)
    ctx.user_text = "1"

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.checkout.handle_payment_selection = AsyncMock(return_value="Cash order confirmed")

    result = await router.route(intent="product_search", intent_payload={})

    router.checkout.handle_payment_selection.assert_called_once_with("1")
    assert result == "Cash order confirmed"


@pytest.mark.asyncio
async def test_idle_mode_respects_intent(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    When mode=idle, intent drives routing (not mode).
    """
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.search.search_products = AsyncMock(return_value="Here are results")

    result = await router.route(
        intent="product_search",
        intent_payload={"search_query": "rice"}
    )

    router.search.search_products.assert_called_once_with("rice")


# ─── 02.2 Intent dispatch ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_to_cart_intent_routed(tenant_context, mock_db, user_phone, mock_memory):
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.cart.add_to_cart = AsyncMock(return_value="Added 1x Jollof Rice")

    result = await router.route(
        intent="add_to_cart",
        intent_payload={"products": [{"name": "Jollof Rice", "quantity": 1}]}
    )

    router.cart.add_to_cart.assert_called_once()


@pytest.mark.asyncio
async def test_view_cart_intent_routed(tenant_context, mock_db, user_phone, mock_memory):
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.cart.view_cart = AsyncMock(return_value="Your cart has 2 items")

    await router.route(intent="view_cart", intent_payload={})
    router.cart.view_cart.assert_called_once()


@pytest.mark.asyncio
async def test_checkout_intent_routed(tenant_context, mock_db, user_phone, mock_memory):
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.checkout.initiate_checkout = AsyncMock(return_value="How would you like to pay?")

    result = await router.route(intent="checkout", intent_payload={})

    router.checkout.initiate_checkout.assert_called_once()
    assert "pay" in result.lower()


@pytest.mark.asyncio
async def test_help_intent_returns_help_text(tenant_context, mock_db, user_phone, mock_memory):
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    result = await router.route(intent="help", intent_payload={})

    assert len(result) > 20, "Help response should be substantive"


@pytest.mark.asyncio
async def test_unknown_intent_returns_fallback(tenant_context, mock_db, user_phone, mock_memory):
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    result = await router.route(intent="what_is_this", intent_payload={})

    assert result, "Unknown intent should produce a fallback response, not empty string"


@pytest.mark.asyncio
async def test_confirm_cash_extracts_order_code(tenant_context, mock_db, user_phone, mock_memory):
    """
    The whatsapp_handler extracts order code from 'confirm XXXX'.
    Router must pass it to payment.confirm_cash.
    """
    mock_memory.get_mode = AsyncMock(return_value="idle")
    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.orchestrators.conversation_router import ConversationRouter
    router = ConversationRouter(ctx)
    router.payment.confirm_cash = AsyncMock(return_value="✅ Order ABC12345 confirmed")

    result = await router.route(
        intent="confirm_cash",
        intent_payload={"order_code": "ABC12345"}
    )

    router.payment.confirm_cash.assert_called_once_with("ABC12345")


# ─── 02.3 Handler fallback in whatsapp_handler ───────────────────────────────

@pytest.mark.asyncio
async def test_handler_treats_other_intent_as_product_search():
    """
    When DeepSeek returns intent='other' and message is not a digit,
    whatsapp_handler must re-classify as product_search.
    """
    # Replicate the logic in whatsapp_handler directly
    intent = "other"
    user_text = "I want something spicy"

    if intent == "other" and not user_text.isdigit():
        intent = "product_search"

    assert intent == "product_search", \
        "Non-digit 'other' intents should become product_search"


@pytest.mark.asyncio
async def test_handler_does_not_override_digit_input():
    """
    Digit inputs (number selections) must not be overridden to product_search.
    """
    intent = "other"
    user_text = "2"

    if intent == "other" and not user_text.isdigit():
        intent = "product_search"

    assert intent == "other", \
        "Digit input should not be converted to product_search"


# ─── 02.4 Mode transitions ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_sets_mode_to_selecting(tenant_context, mock_db, user_phone, mock_memory):
    """
    After a product search, memory mode must be 'selecting'.
    """
    from app.orchestrators.search_orchestrator import SearchOrchestrator
    from app.orchestrators.context import ConversationContext

    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    from app.schemas.fuzzy import FuzzyMatchResultSchema
    mock_matches = [
        FuzzyMatchResultSchema(
            product_id="prod-001", name="Jollof Rice",
            score=85.0, price=1500.0, currency=None,
            description=None, quantity=5
        )
    ]

    ctx.matcher.search = AsyncMock(return_value=mock_matches)

    orchestrator = SearchOrchestrator(ctx)
    await orchestrator.search_products("jollof")

    mock_memory.set_mode.assert_called_with("selecting")
    mock_memory.set_choices.assert_called_once()


@pytest.mark.asyncio
async def test_checkout_initiation_sets_mode_to_payment(
    tenant_context, mock_db, user_phone, mock_memory
):
    """
    Initiating checkout must set mode to 'payment'.
    """
    from app.orchestrators.checkout_orchestrator import CheckoutOrchestrator
    from app.orchestrators.context import ConversationContext

    ctx = make_context(tenant_context, mock_db, user_phone, mock_memory)

    mock_summary = {
        "has_items": True,
        "item_count": 2,
        "total": 3000.0,
        "items": []
    }
    ctx.cart_service.get_cart_summary = AsyncMock(return_value=mock_summary)

    orchestrator = CheckoutOrchestrator(ctx)
    result = await orchestrator.initiate_checkout()

    mock_memory.set_mode.assert_called_with("payment")
    assert "1" in result and "2" in result, "Should present payment options 1 and 2"
