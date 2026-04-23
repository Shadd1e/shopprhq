# app/api/v1/subaccount.py
import logging
from fastapi import APIRouter, Depends, HTTPException, Request

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.flutterwave_subaccount import SubaccountRegisterRequest, SubaccountRead
from app.services.flutterwave_subaccount_service import FlutterwaveSubaccountService
from app.db.deps import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/subaccounts", tags=["Subaccounts"])


def _require_merchant(request: Request) -> str:
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return merchant_id


@router.get("/banks")
async def list_banks(request: Request):
    """
    Returns all Nigerian banks supported by Flutterwave for account resolution
    and subaccount creation. Proxies Flutterwave GET /v3/banks/NG so the
    frontend never needs the secret key directly.
    """
    _require_merchant(request)

    import os, httpx
    secret = os.getenv("FLUTTERWAVE_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=500, detail="Flutterwave not configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.get(
                "https://api.flutterwave.com/v3/banks/NG",
                headers={"Authorization": f"Bearer {secret}"},
            )
        data = res.json()
        if res.status_code != 200 or data.get("status") != "success":
            raise HTTPException(status_code=502, detail="Could not fetch bank list from Flutterwave")

        # Return sorted list: code + name only
        banks = sorted(
            [{"code": b["code"], "name": b["name"]} for b in data.get("data", [])],
            key=lambda b: b["name"],
        )
        return {"banks": banks}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch Flutterwave bank list: %s", e)
        raise HTTPException(status_code=502, detail="Could not fetch bank list. Please try again.")


@router.post("/verify-account")
async def verify_bank_account(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify a bank account number against Flutterwave.
    Returns the account holder name for the merchant to confirm
    before registering the subaccount.
    """
    _require_merchant(request)

    import os, httpx
    body = await request.json()
    account_number = body.get("account_number", "").strip()
    account_bank   = body.get("account_bank", "").strip()

    if not account_number or not account_bank:
        raise HTTPException(status_code=400, detail="account_number and account_bank required")

    secret = os.getenv("FLUTTERWAVE_SECRET_KEY")
    if not secret:
        raise HTTPException(status_code=500, detail="Flutterwave not configured")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(
                "https://api.flutterwave.com/v3/accounts/resolve",
                json={"account_number": account_number, "account_bank": account_bank},
                headers={
                    "Authorization": f"Bearer {secret}",
                    "Content-Type": "application/json",
                },
            )
        # Safe JSON parse — Flutterwave sometimes returns non-JSON on errors
        try:
            data = res.json()
        except Exception:
            data = {}

        if res.status_code != 200 or data.get("status") != "success":
            # data.get("message") can itself be a dict on some Flutterwave errors
            raw_msg = data.get("message", "")
            if isinstance(raw_msg, dict):
                raw_msg = raw_msg.get("error", str(raw_msg))
            detail = str(raw_msg) if raw_msg else "Could not verify account. Check the number and bank."
            raise HTTPException(status_code=400, detail=detail)

        account_name = data.get("data", {}).get("account_name", "")
        if not account_name:
            raise HTTPException(
                status_code=400,
                detail="Account found but name could not be retrieved. Try a different bank."
            )

        return {
            "account_name":   account_name,
            "account_number": account_number,
            "account_bank":   account_bank,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Bank account verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Could not verify account. Please try again.")


@router.post("/{client_id}", response_model=SubaccountRead, status_code=201)
async def register_subaccount(
    client_id: str,
    payload: SubaccountRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a Flutterwave subaccount for a store (client).

    This calls Flutterwave's API with the store's bank details and saves
    the returned subaccount_id. Once registered, all card payments from
    that store will route directly to this bank account.

    The merchant must be authenticated and the client must belong to them.
    """
    merchant_id = _require_merchant(request)

    service = FlutterwaveSubaccountService(db)

    # Check if already registered
    existing = await service.get_for_client(
        client_id=client_id,
        merchant_id=merchant_id,
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Subaccount already registered for this store: {existing.subaccount_id}"
        )

    try:
        subaccount = await service.register(
            client_id=client_id,
            merchant_id=merchant_id,
            account_bank=payload.account_bank,
            account_number=payload.account_number,
            business_name=payload.business_name,
            split_value="0.6",       # Platform takes 0.6% (capped at ₦2,000 at payment time)
            split_type="percentage",
        )
        return subaccount
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Subaccount registration failed for client %s", client_id)
        raise HTTPException(status_code=500, detail="Subaccount registration failed")


@router.get("/{client_id}", response_model=SubaccountRead)
async def get_subaccount(
    client_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Get the registered subaccount for a store."""
    merchant_id = _require_merchant(request)

    service = FlutterwaveSubaccountService(db)
    subaccount = await service.get_for_client(
        client_id=client_id,
        merchant_id=merchant_id,
    )
    if not subaccount:
        raise HTTPException(status_code=404, detail="No subaccount registered for this store")
    return subaccount


@router.delete("/{client_id}")
async def deactivate_subaccount(
    client_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a store's subaccount. Payments will fall back to platform account."""
    merchant_id = _require_merchant(request)

    service = FlutterwaveSubaccountService(db)
    success = await service.deactivate(
        client_id=client_id,
        merchant_id=merchant_id,
    )
    if not success:
        raise HTTPException(status_code=404, detail="No subaccount found")
    return {"detail": "Subaccount deactivated"}

