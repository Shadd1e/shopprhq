# app/services/flutterwave_subaccount_service.py
import os
import logging
import httpx
from typing import Optional
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.flutterwave_subaccount import FlutterwaveSubaccount
from app.db.transaction import transactional

logger = logging.getLogger(__name__)

FLW_BASE = "https://api.flutterwave.com/v3"


class FlutterwaveSubaccountService:
    """
    Manages Flutterwave subaccount registration and lookup.

    One subaccount per Client (store). When a customer pays,
    the subaccount_id is passed in the payment payload so
    Flutterwave routes money directly to that store's bank account.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # =====================================================
    # REGISTER SUBACCOUNT (calls Flutterwave API)
    # =====================================================

    async def register(
        self,
        *,
        client_id: str,
        merchant_id: str,
        account_bank: str,
        account_number: str,
        business_name: str,
        split_value: Optional[str] = None,
        split_type: Optional[str] = "percentage",
    ) -> FlutterwaveSubaccount:
        """
        Register a new Flutterwave subaccount for a store.
        Calls Flutterwave's POST /subaccounts endpoint then
        saves the returned subaccount_id to the DB.

        account_bank: Flutterwave bank code (e.g. "044" for Access Bank)
        account_number: Store's bank account number
        business_name: Store/merchant trading name
        split_value: Platform fee e.g. "2.5" (percentage) or "500" (flat)
        """
        secret = os.getenv("FLUTTERWAVE_SECRET_KEY")
        if not secret:
            raise ValueError("FLUTTERWAVE_SECRET_KEY not configured")

        # Build payload
        payload = {
            "account_bank": account_bank,
            "account_number": account_number,
            "business_name": business_name,
            "business_email": f"{client_id}@shopprhq.app",
            "country": "NG",
        }

        if split_value:
            payload["split_value"] = float(split_value)
            payload["split_type"] = split_type or "percentage"

        headers = {
            "Authorization": f"Bearer {secret}",
            "Content-Type": "application/json",
        }

        logger.info("Registering Flutterwave subaccount for client %s", client_id)

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{FLW_BASE}/subaccounts",
                json=payload,
                headers=headers,
            )

        if response.status_code not in (200, 201):
            logger.error(
                "Flutterwave subaccount registration failed %s: %s",
                response.status_code,
                response.text,
            )
            raise ValueError(
                f"Flutterwave subaccount registration failed: "
                f"{response.json().get('message', response.text)}"
            )

        data = response.json()
        if data.get("status") != "success":
            raise ValueError(
                f"Flutterwave error: {data.get('message', 'Unknown error')}"
            )

        subaccount_id = data["data"]["subaccount_id"]
        logger.info(
            "Flutterwave subaccount created: %s for client %s",
            subaccount_id,
            client_id,
        )

        # Save to DB
        async with transactional(self.db):
            subaccount = FlutterwaveSubaccount(
                client_id=client_id,
                merchant_id=merchant_id,
                subaccount_id=subaccount_id,
                account_bank=account_bank,
                account_number=account_number,
                business_name=business_name,
                split_value=split_value,
                split_type=split_type,
                active=True,
            )
            self.db.add(subaccount)

        return subaccount

    # =====================================================
    # GET SUBACCOUNT FOR CLIENT
    # =====================================================

    async def get_for_client(
        self,
        client_id: str,
        merchant_id: str,
    ) -> Optional[FlutterwaveSubaccount]:
        """Get active subaccount for a client."""
        result = await self.db.execute(
            select(FlutterwaveSubaccount).where(
                FlutterwaveSubaccount.client_id == client_id,
                FlutterwaveSubaccount.merchant_id == merchant_id,
                FlutterwaveSubaccount.active.is_(True),
            )
        )
        return result.scalar_one_or_none()

    # =====================================================
    # GET SUBACCOUNT ID FOR PAYMENT
    # =====================================================

    async def get_subaccount_id(
        self,
        client_id: str,
        merchant_id: str,
    ) -> Optional[str]:
        """
        Returns the subaccount_id string to pass to Flutterwave payment payload.
        Returns None if no subaccount registered (payment goes to platform account).
        """
        subaccount = await self.get_for_client(client_id, merchant_id)
        return subaccount.subaccount_id if subaccount else None

    # =====================================================
    # DEACTIVATE SUBACCOUNT
    # =====================================================

    async def deactivate(
        self,
        client_id: str,
        merchant_id: str,
    ) -> bool:
        """Hard-delete the subaccount from DB so the merchant can reconnect fresh.
        The subaccount remains on Flutterwave permanently (they don't support deletion).
        """
        result = await self.db.execute(
            select(FlutterwaveSubaccount).where(
                FlutterwaveSubaccount.client_id == client_id,
                FlutterwaveSubaccount.merchant_id == merchant_id,
            )
        )
        subaccount = result.scalar_one_or_none()
        if not subaccount:
            return False

        async with transactional(self.db):
            await self.db.delete(subaccount)

        return True
