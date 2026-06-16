"""
TEST GROUP 04 — Checkout & Payment Service
==========================================
Tests the checkout flow end-to-end:
- Inventory validation before order creation
- Cash vs card order path divergence
- Paystack transaction initialization
- Payment record creation
- Cart closure logic (the Bug 4 scenario)
- Cash payment confirmation
- Double-payment prevention

PASS = orders created correctly, payments tracked, carts closed
FAIL = duplicate orders, unclosed carts, wrong payment status
"""

import pytest
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from tests.conftest import make_product, make_cart, make_cart_item, make_order


# ─── 04.1 Checkout validation ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_checkout_fails_on_empty_cart(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    Checkout with empty cart must raise ValueError.
    """
    from app.services.checkout_service import CheckoutService
    from app.schemas.checkout import CheckoutRequestSchema

    empty_cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[])
    empty_cart.items = []

    # Lock query returns cart_id row
    mock_lock = MagicMock()
    mock_lock.first.return_value = (cart_id,)

    # Full cart fetch
    mock_cart_result = MagicMock()
    mock_cart_result.scalars.return_value.first.return_value = empty_cart

    mock_db.execute = AsyncMock(side_effect=[mock_lock, mock_cart_result])

    service = CheckoutService(mock_db)
    with pytest.raises(ValueError, match="empty cart"):
        await service.checkout(CheckoutRequestSchema(
            cart_id=cart_id,
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
            payment_method="cash",
            customer_name="Test User",
        ))


@pytest.mark.asyncio
async def test_checkout_fails_on_already_checked_out_cart(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    Checked-out cart cannot be checked out again.
    """
    from app.services.checkout_service import CheckoutService
    from app.schemas.checkout import CheckoutRequestSchema

    product = make_product(merchant_id, client_id)
    item = make_cart_item(product)
    checked_out_cart = make_cart(merchant_id, client_id, user_phone,
                                  cart_id=cart_id, checked_out=True, items=[item])

    mock_lock = MagicMock()
    mock_lock.first.return_value = (cart_id,)

    mock_cart_result = MagicMock()
    mock_cart_result.scalars.return_value.first.return_value = checked_out_cart

    mock_db.execute = AsyncMock(side_effect=[mock_lock, mock_cart_result])

    service = CheckoutService(mock_db)
    with pytest.raises(ValueError, match="already checked out"):
        await service.checkout(CheckoutRequestSchema(
            cart_id=cart_id,
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
            payment_method="cash",
            customer_name="Test User",
        ))


@pytest.mark.asyncio
async def test_checkout_fails_on_insufficient_inventory(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    If inventory is below requested quantity, checkout must raise ValueError.
    """
    from app.services.checkout_service import CheckoutService
    from app.schemas.checkout import CheckoutRequestSchema

    product = make_product(merchant_id, client_id)
    product.inventory.quantity = 0  # Out of stock

    item = make_cart_item(product, quantity=2)
    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[item])

    mock_lock = MagicMock()
    mock_lock.first.return_value = (cart_id,)

    mock_cart_result = MagicMock()
    mock_cart_result.scalars.return_value.first.return_value = cart

    mock_db.execute = AsyncMock(side_effect=[mock_lock, mock_cart_result])

    service = CheckoutService(mock_db)
    with pytest.raises(ValueError, match="[Ii]nventory|[Ss]tock"):
        await service.checkout(CheckoutRequestSchema(
            cart_id=cart_id,
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
            payment_method="card",
            customer_name="Test User",
        ))


# ─── 04.2 Cart closure logic (Bug 4) ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_cash_checkout_closes_cart_immediately(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    BUG 4 GUARD: Cash orders must close the cart during checkout (not waiting for webhook).
    """
    from app.services.checkout_service import CheckoutService
    from app.schemas.checkout import CheckoutRequestSchema

    product = make_product(merchant_id, client_id)
    item = make_cart_item(product, quantity=1, price=1500.0)
    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[item])

    mock_lock = MagicMock()
    mock_lock.first.return_value = (cart_id,)
    mock_cart_result = MagicMock()
    mock_cart_result.scalars.return_value.first.return_value = cart
    mock_db.execute = AsyncMock(side_effect=[mock_lock, mock_cart_result])
    mock_db.flush = AsyncMock()

    with patch("app.services.checkout_service.PaymentService") as MockPaymentService:

        mock_ps_instance = AsyncMock()
        mock_ps_instance.create_cash_payment = AsyncMock()
        mock_ps_instance.create = AsyncMock()
        MockPaymentService.return_value = mock_ps_instance

        service = CheckoutService(mock_db)
        service.payment_service = mock_ps_instance
        service.inventory_service = AsyncMock()
        service.cart_service = AsyncMock()

        await service.checkout(CheckoutRequestSchema(
            cart_id=cart_id,
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
            payment_method="cash",
            customer_name="Test User",
        ))

    assert cart.checked_out is True, \
        "BUG 4: Cash orders must close cart immediately at checkout"


@pytest.mark.asyncio
async def test_card_checkout_does_not_close_cart_immediately(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    BUG 4 GUARD: Card orders must NOT close the cart during checkout —
    cart closure happens when Flutterwave webhook fires.
    """
    from app.services.checkout_service import CheckoutService
    from app.schemas.checkout import CheckoutRequestSchema

    product = make_product(merchant_id, client_id)
    item = make_cart_item(product, quantity=1, price=1500.0)
    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[item])

    mock_lock = MagicMock()
    mock_lock.first.return_value = (cart_id,)
    mock_cart_result = MagicMock()
    mock_cart_result.scalars.return_value.first.return_value = cart
    mock_db.execute = AsyncMock(side_effect=[mock_lock, mock_cart_result])
    mock_db.flush = AsyncMock()

    with patch("app.services.checkout_service.PaymentService") as MockPaymentService, \
         patch("app.services.checkout_service.FlutterwaveSubaccountService") as MockSubSvc, \
         patch.object(CheckoutService, "create_flutterwave_payment_link",
                      new_callable=AsyncMock, return_value="https://pay.flutterwave.com/abc"):

        mock_ps_instance = AsyncMock()
        mock_ps_instance.create_flutterwave_payment = AsyncMock()
        MockPaymentService.return_value = mock_ps_instance

        mock_sub_instance = AsyncMock()
        mock_sub_instance.get_subaccount_id = AsyncMock(return_value=None)
        MockSubSvc.return_value = mock_sub_instance

        service = CheckoutService(mock_db)
        service.payment_service = mock_ps_instance
        service.inventory_service = AsyncMock()
        service.cart_service = AsyncMock()

        result = await service.checkout(CheckoutRequestSchema(
            cart_id=cart_id,
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
            payment_method="card",
            customer_name="Test User",
        ))

    assert cart.checked_out is False, \
        "BUG 4: Card orders must leave cart OPEN until webhook fires"
    assert result.payment_link is not None


# ─── 04.3 Payment service ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_payment_create_rejects_amount_mismatch(mock_db, merchant_id, client_id, order_id):
    """
    Payment amount must match order total — rejects mismatches.
    """
    from app.services.payment_service import PaymentService
    from app.schemas.payment import PaymentCreate
    from app.models.payment import PaymentStatus

    order = make_order(merchant_id, client_id, "234xxx", order_id=order_id)
    order.total_amount = 3000.0

    mock_order_result = MagicMock()
    mock_order_result.scalar_one_or_none.return_value = order

    mock_payment_check = MagicMock()
    mock_payment_check.scalars.return_value.first.return_value = None  # No existing payment

    mock_db.execute = AsyncMock(side_effect=[mock_order_result, mock_payment_check])

    service = PaymentService(mock_db)
    with pytest.raises(ValueError, match="[Mm]ismatch|amount"):
        await service.create(PaymentCreate(
            order_id=order_id,
            merchant_id=merchant_id,
            client_id=client_id,
            amount=2000.0,  # Wrong amount
            method="cash",
            status=PaymentStatus.PENDING,
        ))


@pytest.mark.asyncio
async def test_payment_rejects_double_successful_payment(mock_db, merchant_id, client_id, order_id):
    """
    If order already has a SUCCEEDED payment, creating another raises ValueError.
    """
    from app.services.payment_service import PaymentService
    from app.schemas.payment import PaymentCreate
    from app.models.payment import PaymentStatus

    order = make_order(merchant_id, client_id, "234xxx", order_id=order_id)
    order.total_amount = 3000.0

    existing_payment = MagicMock()
    existing_payment.status = PaymentStatus.SUCCEEDED

    mock_order_result = MagicMock()
    mock_order_result.scalar_one_or_none.return_value = order

    mock_payment_check = MagicMock()
    mock_payment_check.scalars.return_value.first.return_value = existing_payment  # Already paid

    mock_db.execute = AsyncMock(side_effect=[mock_order_result, mock_payment_check])

    service = PaymentService(mock_db)
    with pytest.raises(ValueError, match="[Aa]lready.*payment|double"):
        await service.create(PaymentCreate(
            order_id=order_id,
            merchant_id=merchant_id,
            client_id=client_id,
            amount=3000.0,
            method="cash",
            status=PaymentStatus.PENDING,
        ))


@pytest.mark.asyncio
async def test_payment_status_update_idempotent_for_succeeded(mock_db, merchant_id, client_id):
    """
    Updating an already-SUCCEEDED payment to SUCCEEDED again is safe (idempotent).
    """
    from app.services.payment_service import PaymentService
    from app.models.payment import PaymentStatus

    payment = MagicMock()
    payment.id = str(uuid.uuid4())
    payment.status = PaymentStatus.SUCCEEDED
    payment.merchant_id = merchant_id
    payment.client_id = client_id
    payment.payment_metadata = {}

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = payment
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = PaymentService(mock_db)
    result = await service.update_status(
        payment_id=payment.id,
        merchant_id=merchant_id,
        client_id=client_id,
        new_status=PaymentStatus.SUCCEEDED,
    )

    assert result.status == PaymentStatus.SUCCEEDED
    mock_db.flush.assert_not_called()  # No-op when already succeeded


# ─── 04.4 Flutterwave webhook handling ───────────────────────────────────────

@pytest.mark.asyncio
async def test_flutterwave_webhook_maps_successful_status(mock_db, merchant_id, client_id):
    """
    'successful' from Flutterwave maps to PaymentStatus.SUCCEEDED.
    """
    from app.services.payment_service import PaymentService
    from app.models.payment import PaymentStatus

    payment = MagicMock()
    payment.id = str(uuid.uuid4())
    payment.order_id = str(uuid.uuid4())
    payment.status = PaymentStatus.PENDING
    payment.merchant_id = merchant_id
    payment.client_id = client_id
    payment.payment_metadata = {}

    mock_lock_result = MagicMock()
    mock_lock_result.scalar_one_or_none.return_value = payment

    mock_succeeded_check = MagicMock()
    mock_succeeded_check.scalars.return_value.first.return_value = None

    mock_update_result = MagicMock()
    mock_update_result.scalar_one_or_none.return_value = payment

    mock_db.execute = AsyncMock(side_effect=[
        mock_lock_result,       # handle_flutterwave_webhook → payment lookup
        mock_succeeded_check,   # _order_has_successful_payment check
        mock_update_result,     # update_status → payment lock
    ])

    service = PaymentService(mock_db)
    result = await service.handle_flutterwave_webhook(
        tx_ref="order_abc123",
        webhook_status="successful",
        payload={"id": 9999},
    )

    assert result.status == PaymentStatus.SUCCEEDED


@pytest.mark.asyncio
async def test_flutterwave_webhook_idempotent_already_succeeded(mock_db):
    """
    If payment is already SUCCEEDED, webhook handler returns early without re-processing.
    """
    from app.services.payment_service import PaymentService
    from app.models.payment import PaymentStatus

    payment = MagicMock()
    payment.id = str(uuid.uuid4())
    payment.status = PaymentStatus.SUCCEEDED  # Already done

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = payment
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = PaymentService(mock_db)
    result = await service.handle_flutterwave_webhook(
        tx_ref="order_already_done",
        webhook_status="successful",
        payload={},
    )

    assert result.status == PaymentStatus.SUCCEEDED
    mock_db.flush.assert_not_called()  # No write needed


@pytest.mark.asyncio
async def test_flutterwave_webhook_unknown_tx_ref_raises(mock_db):
    """
    Unknown tx_ref → ValueError. Should not silently succeed.
    """
    from app.services.payment_service import PaymentService

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # Not found
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = PaymentService(mock_db)
    with pytest.raises(ValueError, match="[Nn]ot found|tx_ref"):
        await service.handle_flutterwave_webhook(
            tx_ref="nonexistent_ref",
            webhook_status="successful",
            payload={},
        )


# ─── 04.5 Cash confirmation (Bug 1 guard) ────────────────────────────────────

@pytest.mark.asyncio
async def test_confirm_cash_requires_order_object_not_string(mock_db, merchant_id, client_id):
    """
    BUG 1 GUARD: PaymentService.confirm_cash_payment takes an Order object,
    NOT an order_code string. Calling with wrong args must TypeError immediately.
    """
    from app.services.payment_service import PaymentService
    import inspect

    sig = inspect.signature(PaymentService.confirm_cash_payment)
    params = list(sig.parameters.keys())

    assert "order" in params, \
        "BUG 1: confirm_cash_payment must accept 'order' (Order object) param"
    assert "order_code" not in params, \
        "BUG 1: confirm_cash_payment does NOT accept 'order_code' — orchestrator must look it up first"
    assert "from_phone" not in params, \
        "BUG 1: confirm_cash_payment does NOT accept 'from_phone' — orchestrator was calling wrong signature"
