# app/services/checkout_service.py

import logging
from typing import Optional
from datetime import datetime, timezone
from decimal import Decimal
import httpx
import os

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.models.payment import PaymentStatus
from app.models.cart import Cart, CartItem
from app.models.order import Order, OrderStatus, DeliveryType, generate_order_code
from app.models.product import Product
from app.schemas.checkout import CheckoutRequestSchema, CheckoutResponseSchema
from app.schemas.payment import PaymentCreate
from app.services.payment_service import PaymentService
from app.services.inventory_service import InventoryService
from app.services.cart_service import CartService
from app.core.helpers import number_to_words
from app.models.utils import generate_uuid
from app.services.flutterwave_subaccount_service import FlutterwaveSubaccountService

logger = logging.getLogger(__name__)


class CheckoutService:
    """
    Pure domain service.

    RULES:
    - NO transaction ownership
    - NO commit()
    - NO rollback()
    - Caller (orchestrator) owns transaction boundary
    """

    def __init__(self, db: AsyncSession):
        if not db:
            raise ValueError("AsyncSession required")

        self.db = db
        self.payment_service    = PaymentService(db)
        self.inventory_service  = InventoryService(db)
        self.cart_service       = CartService(db)

    # ==================================================
    # PUBLIC ENTRYPOINT
    # ==================================================

    async def checkout(
        self,
        data: CheckoutRequestSchema,
    ) -> CheckoutResponseSchema:

        if not data.merchant_id or not data.client_id or not data.user_id:
            raise ValueError("Missing tenant context")

        if not data.cart_id:
            raise ValueError("cart_id is required")

        return await self._checkout_internal(data)

    # ==================================================
    # INTERNAL CHECKOUT LOGIC
    # ==================================================

    async def _checkout_internal(
        self,
        data: CheckoutRequestSchema,
    ) -> CheckoutResponseSchema:

        # ----------------------------
        # LOCK CART ROW
        # ----------------------------
        lock = await self.db.execute(
            text("SELECT id FROM carts WHERE id = :id FOR UPDATE"),
            {"id": data.cart_id},
        )

        if not lock.first():
            raise ValueError("Cart not found")

        # ----------------------------
        # FETCH CART WITH RELATIONS
        # ----------------------------
        result = await self.db.execute(
            select(Cart)
            .where(
                Cart.id == data.cart_id,
                Cart.merchant_id == data.merchant_id,
                Cart.client_id == data.client_id,
                Cart.user_id == data.user_id,
            )
            .options(
                selectinload(Cart.items)
                .selectinload(CartItem.product)
                .selectinload(Product.inventory)
            )
        )

        cart = result.scalars().first()

        if not cart:
            raise ValueError("Cart not found for tenant")

        if cart.checked_out:
            raise ValueError("Cart already checked out")

        # Idempotency guard — heal checked_out flag if order already exists
        existing_order_result = await self.db.execute(
            select(Order).where(Order.cart_id == cart.id).limit(1)
        )
        if existing_order_result.scalars().first():
            if not cart.checked_out:
                cart.checked_out = True
                cart.checked_out_at = datetime.now(timezone.utc)
                await self.db.flush()
                logger.info("Healed checked_out flag for cart %s", cart.id)
            raise ValueError("Cart already has an active order")

        if not cart.items:
            raise ValueError("Cannot checkout empty cart")

        # ----------------------------
        # INVENTORY VALIDATION & DEDUCTION (LOCKED)
        # Lock each inventory row and deduct stock atomically for ALL payment
        # methods. Previously this was a read-only check (no FOR UPDATE) and
        # deduction only happened in the Flutterwave webhook — meaning every
        # cash order bypassed stock deduction entirely.
        # ----------------------------
        for item in cart.items:
            try:
                await self.inventory_service.finalize_sale(
                    merchant_id=data.merchant_id,
                    client_id=data.client_id,
                    product_id=str(item.product_id),
                    quantity=item.quantity,
                )
            except ValueError as inv_err:
                product_name = (
                    item.product.name
                    if hasattr(item, "product") and item.product
                    else str(item.product_id)
                )
                raise ValueError(
                    f"Insufficient stock for '{product_name}': {inv_err}"
                ) from inv_err

        # ----------------------------
        # CALCULATE ITEM TOTAL
        # ----------------------------
        items_total = sum(
            Decimal(str(i.price_at_add)) * Decimal(str(i.quantity))
            for i in cart.items
        )

        # ----------------------------
        # DELIVERY FEE
        # ----------------------------
        delivery_fee = Decimal("0")
        delivery_type_value = None

        if data.delivery_type == "delivery":
            delivery_type_value = DeliveryType.DELIVERY
            if data.delivery_fee is not None:
                delivery_fee = Decimal(str(data.delivery_fee))
        elif data.delivery_type == "pickup":
            delivery_type_value = DeliveryType.PICKUP

        grand_total   = items_total + delivery_fee
        total_float   = float(grand_total)
        total_words   = number_to_words(total_float)

        # ----------------------------
        # ORDER STATUS
        # ----------------------------
        if data.payment_method == "card":
            initial_status = OrderStatus.PENDING_PAYMENT
        elif data.payment_method in {"cash", "wishlist"}:
            if delivery_type_value == DeliveryType.DELIVERY:
                # Delivery cash orders sit at AWAITING_PICKUP until dispatched
                initial_status = OrderStatus.AWAITING_PICKUP
            else:
                initial_status = OrderStatus.AWAITING_PICKUP
        else:
            initial_status = OrderStatus.CREATED

        # ----------------------------
        # CREATE ORDER
        # ----------------------------
        order = Order(
            id=generate_uuid(),
            cart_id=cart.id,
            merchant_id=cart.merchant_id,
            client_id=cart.client_id,
            user_id=data.user_id,
            customer_name=data.customer_name,
            payment_method=data.payment_method,
            total_amount=float(grand_total),    # grand total (items + delivery fee)
            order_code=generate_order_code(),
            status=initial_status,
            delivery_type=delivery_type_value,
            delivery_address=data.delivery_address or None,
            delivery_contact_number=data.delivery_contact_number or None,
            delivery_fee=float(delivery_fee) if delivery_fee else None,
        )

        self.db.add(order)
        await self.db.flush()

        flutterwave_link = None

        # ----------------------------
        # CREATE PAYMENT RECORD
        # ----------------------------
        if data.payment_method == "card":

            tx_ref = f"order_{order.id}"

            await self.payment_service.create_flutterwave_payment(
                order_id=str(order.id),
                merchant_id=cart.merchant_id,
                client_id=cart.client_id,
                amount=Decimal(str(total_float)),
                tx_ref=tx_ref,
                customer_phone=data.user_id,
            )

            subaccount_service = FlutterwaveSubaccountService(self.db)
            subaccount_id = await subaccount_service.get_subaccount_id(
                client_id=cart.client_id,
                merchant_id=cart.merchant_id,
            )

            try:
                flutterwave_link = await self.create_flutterwave_payment_link(
                    tx_ref=tx_ref,
                    amount=total_float,
                    phone=data.user_id,
                    subaccount_id=subaccount_id,
                )
            except Exception as flw_err:
                logger.error(
                    "Flutterwave link creation failed for order %s: %s",
                    order.id, flw_err,
                )
                # Re-open the cart so the customer can retry checkout.
                # Without this the cart stays checked_out=True forever
                # because the non-card close block below won't run.
                cart.checked_out = False
                cart.checked_out_at = None
                await self.db.flush()
                raise ValueError(
                    "Payment link could not be generated. Please try again in a moment."
                ) from flw_err

        elif data.payment_method == "cash":

            await self.payment_service.create_cash_payment(
                order_id=str(order.id),
                merchant_id=cart.merchant_id,
                client_id=cart.client_id,
                amount=Decimal(str(total_float)),
                customer_name=data.customer_name,
            )

        else:

            await self.payment_service.create(
                PaymentCreate(
                    order_id=str(order.id),
                    merchant_id=cart.merchant_id,
                    client_id=cart.client_id,
                    amount=total_float,
                    method=data.payment_method,
                    status=PaymentStatus.PENDING,
                )
            )

        # ----------------------------
        # CLOSE CART (NON-CARD ONLY)
        # ----------------------------
        if data.payment_method != "card":
            cart.checked_out = True
            cart.checked_out_at = datetime.now(timezone.utc)

        # ----------------------------
        # PERSIST LAST ORDER ON PROFILE
        # Allows repeat-order prompt on next visit ("Want the same again?").
        # Only written for cash orders (card orders might not complete).
        # Non-fatal — never blocks the checkout response.
        # ----------------------------
        if data.payment_method == "cash":
            try:
                from sqlalchemy import select as _sel
                from app.models.customer_profile import CustomerProfile as _CP
                _profile_res = await self.db.execute(
                    _sel(_CP).where(_CP.phone_number == data.user_id)
                )
                _profile = _profile_res.scalar_one_or_none()
                if _profile is not None:
                    _profile.set_last_order(
                        order_code=order.order_code,
                        total=total_float,
                        items=[
                            {"name": i.product.name, "qty": i.quantity}
                            for i in cart.items
                            if hasattr(i, "product") and i.product
                        ],
                        store=cart.client_id,
                        client_id=cart.client_id,
                    )
                    await self.db.flush()
            except Exception as _loe:
                logger.warning("last_order write failed (non-fatal): %s", _loe)

        # ----------------------------
        # RESPONSE
        # ----------------------------
        return CheckoutResponseSchema(
            success=True,
            order_id=str(order.id),
            order_code=order.order_code,
            order_status=order.status.value,
            message=(
                f"Order placed successfully!\n"
                f"Total: {total_words} Naira\n"
                f"Order Code: {order.order_code}"
            ),
            total_amount=total_float,
            payment_instructions=None,
            estimated_time="30–45 minutes",
            store_contact="Store",
            payment_link=flutterwave_link,
        )

    # ==================================================
    # WHATSAPP WRAPPER
    # ==================================================

    async def checkout_from_whatsapp(
        self,
        *,
        merchant_id: str,
        client_id: str,
        user_id: str,
        payment_method: str,
        customer_name: Optional[str] = None,
        delivery_type: Optional[str] = None,          # "pickup" | "delivery" | None
        delivery_address: Optional[str] = None,
        delivery_contact_number: Optional[str] = None,
        delivery_fee: Optional[float] = None,
        tenant_context=None,
    ) -> CheckoutResponseSchema:

        cart = await self.cart_service.get_active_cart(
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_id,
        )

        if not cart:
            raise ValueError("No active cart found.")

        checkout_data = CheckoutRequestSchema(
            cart_id=str(cart.id),
            merchant_id=merchant_id,
            client_id=client_id,
            user_id=user_id,
            payment_method=payment_method,
            customer_name=customer_name or user_id,
            pickup_location=None,
            delivery_address=delivery_address,
            delivery_type=delivery_type,
            delivery_contact_number=delivery_contact_number,
            delivery_fee=delivery_fee,
        )

        return await self.checkout(checkout_data)

    # ==================================================
    # FLUTTERWAVE EXTERNAL CALL
    # ==================================================

    async def create_flutterwave_payment_link(
        self,
        *,
        tx_ref: str,
        amount: float,
        phone: str,
        subaccount_id: str = None,
    ) -> str:

        secret   = os.getenv("FLUTTERWAVE_SECRET_KEY")
        base_url = os.getenv("FLUTTERWAVE_BASE_URL", "https://api.flutterwave.com/v3")

        if not secret:
            raise ValueError("Flutterwave secret not configured")

        payload = {
            "tx_ref":       tx_ref,
            "amount":       amount,
            "currency":     "NGN",
            "redirect_url": (
                os.getenv("FLUTTERWAVE_REDIRECT_URL")
                or (
                    f"https://{os.getenv('RAILWAY_PUBLIC_DOMAIN')}/payment-success"
                    if os.getenv("RAILWAY_PUBLIC_DOMAIN")
                    else "https://shopprhq.app/payment-success"
                )
            ),
            "customer": {
                "phonenumber": phone,
                "name":        "Customer",
                "email":       f"{phone}@example.com",
            },
        }

        if subaccount_id:
            _PLATFORM_FEE_PCT = 0.6    # 0.6% of order value
            _PLATFORM_FEE_CAP = 2000   # ₦2,000 maximum
            _fee = round(amount * _PLATFORM_FEE_PCT / 100, 2)
            if _fee >= _PLATFORM_FEE_CAP:
                _charge_type, _charge = "flat", _PLATFORM_FEE_CAP
            else:
                _charge_type, _charge = "percentage", _PLATFORM_FEE_PCT
            payload["subaccounts"] = [{
                "id": subaccount_id,
                "transaction_charge_type": _charge_type,
                "transaction_charge": _charge,
            }]
            logger.info(
                "Payment routed to subaccount %s — platform fee: %s %s (order: ₦%s)",
                subaccount_id, _charge, _charge_type, amount,
            )
        else:
            logger.warning(
                "No subaccount for client — payment goes to platform account. "
                "Register one via POST /api/v1/subaccounts/{client_id}"
            )

        headers = {
            "Authorization": f"Bearer {secret}",
            "Content-Type":  "application/json",
        }

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{base_url}/payments",
                json=payload,
                headers=headers,
            )

        if response.status_code != 200:
            logger.error("Flutterwave error: %s", response.text)
            raise ValueError("Failed to initialize payment")

        data = response.json()
        link = data.get("data", {}).get("link")

        if not link:
            raise ValueError("Flutterwave did not return payment link")

        return link
