"""
TEST GROUP 03 — Cart Service
============================
Tests the full cart lifecycle: create, add, update quantity,
remove, clear, view summary, and tenant isolation.

PASS = cart operations are correct, tenant-safe, and atomic
FAIL = wrong items, cross-tenant leaks, or silent failures
"""

import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch, call
from tests.conftest import make_product, make_cart, make_cart_item


# ─── 03.1 Cart creation ───────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_cart_returns_new_cart(mock_db, merchant_id, client_id, user_phone):
    """
    Creating a cart when none exists returns a new cart object.
    """
    from app.services.cart_service import CartService

    # First get_active_cart returns None (no existing cart)
    # Then after creation, _get_cart_readonly returns the new cart
    new_cart = make_cart(merchant_id, client_id, user_phone)

    # Mock: get_active_cart → None, then readonly fetch → new_cart
    mock_result_none = MagicMock()
    mock_result_none.scalars.return_value.first.return_value = None
    mock_result_cart = MagicMock()
    mock_result_cart.scalars.return_value.first.return_value = new_cart

    mock_db.execute = AsyncMock(side_effect=[
        mock_result_none,  # get_active_cart (inside create_cart)
        mock_result_cart,  # _get_cart_readonly at end
    ])

    # transactional context manager
    mock_db.commit = AsyncMock()
    mock_db.rollback = AsyncMock()

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        result = await service.create_cart(
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
        )

    mock_db.add.assert_called_once()


@pytest.mark.asyncio
async def test_create_cart_returns_existing_if_active(mock_db, merchant_id, client_id, user_phone):
    """
    If user already has an active cart, create_cart returns it without creating a new one.
    """
    from app.services.cart_service import CartService

    existing_cart = make_cart(merchant_id, client_id, user_phone)

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = existing_cart
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        result = await service.create_cart(
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_phone,
        )

    mock_db.add.assert_not_called()  # No new cart created


# ─── 03.2 Add item ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_add_item_increments_existing(mock_db, merchant_id, client_id, user_phone, product_id, cart_id):
    """
    Adding a product that's already in the cart increments quantity, doesn't duplicate.
    """
    from app.services.cart_service import CartService
    from app.schemas.cart import CartItemSchema

    product = make_product(merchant_id, client_id, product_id=product_id)
    existing_item = make_cart_item(product, quantity=2)
    cart = make_cart(merchant_id, client_id, user_phone,
                     cart_id=cart_id, items=[existing_item])

    # Sequence: cart fetch → product fetch → cart readonly
    mock_cart_result = MagicMock()
    mock_cart_result.scalar_one_or_none.return_value = cart

    mock_product_result = MagicMock()
    mock_product_result.scalar_one_or_none.return_value = product

    mock_readonly_result = MagicMock()
    mock_readonly_result.scalars.return_value.first.return_value = cart

    mock_db.execute = AsyncMock(side_effect=[
        mock_cart_result,
        mock_product_result,
        mock_readonly_result,
    ])

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        await service.add_item(
            merchant_id=merchant_id,
            client_id=client_id,
            cart_id=cart_id,
            item=CartItemSchema(product_id=product_id, quantity=1, price_at_add=1500.0),
        )

    # Existing item quantity should be incremented
    assert existing_item.quantity == 3, "Adding existing product should increment quantity"
    mock_db.add.assert_not_called()  # No new CartItem added


@pytest.mark.asyncio
async def test_add_item_rejects_checked_out_cart(mock_db, merchant_id, client_id, user_phone, product_id, cart_id):
    """
    Cannot add items to a checked-out cart.
    """
    from app.services.cart_service import CartService
    from app.schemas.cart import CartItemSchema

    checked_out_cart = make_cart(merchant_id, client_id, user_phone,
                                  cart_id=cart_id, checked_out=True)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = checked_out_cart
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        with pytest.raises(ValueError, match="already checked out"):
            await service.add_item(
                merchant_id=merchant_id,
                client_id=client_id,
                cart_id=cart_id,
                item=CartItemSchema(product_id=product_id, quantity=1, price_at_add=1500.0),
            )


@pytest.mark.asyncio
async def test_add_item_rejects_wrong_tenant_product(mock_db, merchant_id, client_id, user_phone, product_id, cart_id):
    """
    Adding a product from a different tenant must fail — tenant isolation.
    """
    from app.services.cart_service import CartService
    from app.schemas.cart import CartItemSchema

    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id)

    mock_cart_result = MagicMock()
    mock_cart_result.scalar_one_or_none.return_value = cart

    # Product not found for this tenant
    mock_product_result = MagicMock()
    mock_product_result.scalar_one_or_none.return_value = None

    mock_db.execute = AsyncMock(side_effect=[mock_cart_result, mock_product_result])

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        with pytest.raises(ValueError, match="Product not found"):
            await service.add_item(
                merchant_id=merchant_id,
                client_id=client_id,
                cart_id=cart_id,
                item=CartItemSchema(product_id=product_id, quantity=1, price_at_add=1500.0),
            )


# ─── 03.3 Remove item ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_remove_item_deletes_from_cart(mock_db, merchant_id, client_id, user_phone, product_id, cart_id):
    """
    Removing an item calls db.delete on that CartItem.
    """
    from app.services.cart_service import CartService

    product = make_product(merchant_id, client_id, product_id=product_id)
    item = make_cart_item(product)
    item.product_id = product_id  # Ensure match

    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[item])

    mock_cart_result = MagicMock()
    mock_cart_result.scalar_one_or_none.return_value = cart

    mock_readonly_result = MagicMock()
    mock_readonly_result.scalars.return_value.first.return_value = cart

    mock_db.execute = AsyncMock(side_effect=[mock_cart_result, mock_readonly_result])

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        await service.remove_item(
            merchant_id=merchant_id,
            client_id=client_id,
            cart_id=cart_id,
            product_id=product_id,
        )

    mock_db.delete.assert_called_once_with(item)


@pytest.mark.asyncio
async def test_remove_item_raises_if_not_in_cart(mock_db, merchant_id, client_id, user_phone, product_id, cart_id):
    """
    Removing an item that's not in the cart raises ValueError.
    """
    from app.services.cart_service import CartService

    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[])
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = cart
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        with pytest.raises(ValueError, match="not found in cart"):
            await service.remove_item(
                merchant_id=merchant_id,
                client_id=client_id,
                cart_id=cart_id,
                product_id=product_id,
            )


# ─── 03.4 Clear cart ──────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_clear_cart_deletes_all_items(mock_db, merchant_id, client_id, user_phone, product_id, cart_id):
    """
    Clearing cart deletes every item.
    """
    from app.services.cart_service import CartService

    product = make_product(merchant_id, client_id, product_id=product_id)
    items = [make_cart_item(product), make_cart_item(product)]
    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=items)

    mock_cart_result = MagicMock()
    mock_cart_result.scalar_one_or_none.return_value = cart

    mock_readonly_result = MagicMock()
    empty_cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[])
    mock_readonly_result.scalars.return_value.first.return_value = empty_cart

    mock_db.execute = AsyncMock(side_effect=[mock_cart_result, mock_readonly_result])

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        await service.clear_cart(
            merchant_id=merchant_id,
            client_id=client_id,
            cart_id=cart_id,
        )

    assert mock_db.delete.call_count == 2, "Should delete all 2 items"


# ─── 03.5 Cart summary ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_cart_summary_calculates_total(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    Summary correctly calculates total from price_at_add × quantity.
    """
    from app.services.cart_service import CartService

    product1 = make_product(merchant_id, client_id, name="Jollof", price=1500.0, product_id=str(uuid.uuid4()))
    product2 = make_product(merchant_id, client_id, name="Chicken", price=2000.0, product_id=str(uuid.uuid4()))
    item1 = make_cart_item(product1, quantity=2, price=1500.0)  # 3000
    item2 = make_cart_item(product2, quantity=1, price=2000.0)  # 2000
    # Total should be 5000

    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, items=[item1, item2])

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = cart
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = CartService(mock_db)
    summary = await service.get_cart_summary(
        merchant_id=merchant_id,
        client_id=client_id,
        user_id=user_phone,
    )

    assert summary["has_items"] is True
    assert summary["total"] == 5000.0
    assert summary["item_count"] == 3  # 2 + 1


@pytest.mark.asyncio
async def test_get_cart_summary_empty_cart(mock_db, merchant_id, client_id, user_phone):
    """
    Empty cart returns has_items=False and total=0.
    """
    from app.services.cart_service import CartService

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    service = CartService(mock_db)
    summary = await service.get_cart_summary(
        merchant_id=merchant_id,
        client_id=client_id,
        user_id=user_phone,
    )

    assert summary["has_items"] is False
    assert summary["total"] == 0
    assert summary["items"] == []


# ─── 03.6 Mark checked out ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_mark_as_checked_out_sets_flag(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    mark_as_checked_out sets checked_out=True on the cart.
    """
    from app.services.cart_service import CartService

    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, checked_out=False)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = cart

    mock_readonly = MagicMock()
    mock_readonly.scalars.return_value.first.return_value = cart

    mock_db.execute = AsyncMock(side_effect=[mock_result, mock_readonly])

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        await service.mark_as_checked_out(
            merchant_id=merchant_id,
            client_id=client_id,
            cart_id=cart_id,
        )

    assert cart.checked_out is True


@pytest.mark.asyncio
async def test_mark_as_checked_out_idempotent(mock_db, merchant_id, client_id, user_phone, cart_id):
    """
    Calling mark_as_checked_out on an already-checked-out cart is safe (idempotent).
    """
    from app.services.cart_service import CartService

    cart = make_cart(merchant_id, client_id, user_phone, cart_id=cart_id, checked_out=True)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = cart
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.services.cart_service.transactional") as mock_tx:
        mock_tx.return_value.__aenter__ = AsyncMock(return_value=None)
        mock_tx.return_value.__aexit__ = AsyncMock(return_value=False)

        service = CartService(mock_db)
        # Should NOT raise
        await service.mark_as_checked_out(
            merchant_id=merchant_id,
            client_id=client_id,
            cart_id=cart_id,
        )
