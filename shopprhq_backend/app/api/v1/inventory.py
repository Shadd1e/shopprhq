from fastapi import APIRouter, Depends, Request, Header, HTTPException, status
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.product import ProductRead
from app.services.inventory_service import InventoryService
import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


def get_tenant_context(
    request: Request,
    x_merchant_id: Optional[str] = Header(default=None, alias="X-Merchant-ID"),
    x_client_id: Optional[str] = Header(default=None, alias="X-Client-ID"),
):
    # Require a valid JWT — X-Merchant-ID header alone is not sufficient
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    merchant_id = x_merchant_id or getattr(request.state, "merchant_id", None)
    client_id = x_client_id or getattr(request.state, "client_id", None)

    if not merchant_id or not client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing merchant or client ID",
        )

    return merchant_id, client_id


@router.get("/", response_model=List[ProductRead], response_model_exclude_none=True)
async def list_inventory(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_merchant_id: Optional[str] = Header(default=None, alias="X-Merchant-ID"),
    x_client_id: Optional[str] = Header(default=None, alias="X-Client-ID"),
):
    """
    Return all products accessible to the client under the given merchant.
    Essentially a view of the inventory scoped by tenant.
    """
    merchant_id, client_id = get_tenant_context(request, x_merchant_id, x_client_id)
    service = InventoryService(db)
    products = await service.list_products_for_client(merchant_id, client_id)
    return products

@router.patch("/{product_id}/low-stock-threshold")
async def set_low_stock_threshold(
    product_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_merchant_id: Optional[str] = Header(default=None, alias="X-Merchant-ID"),
    x_client_id: Optional[str] = Header(default=None, alias="X-Client-ID"),
):
    """
    Set the low stock warning threshold for a product.
    Operator is notified when stock drops to or below this number.

    Body: {"threshold": 5}
    Set threshold to null to disable warnings for this product.
    """
    merchant_id, client_id = get_tenant_context(request, x_merchant_id, x_client_id)

    body = await request.json()
    threshold = body.get("threshold")  # int or None

    if threshold is not None and (not isinstance(threshold, int) or threshold < 0):
        raise HTTPException(status_code=400, detail="threshold must be a non-negative integer or null")

    from sqlalchemy import select
    from app.models.inventory import Inventory
    result = await db.execute(
        select(Inventory).where(
            Inventory.merchant_id == merchant_id,
            Inventory.client_id == client_id,
            Inventory.product_id == product_id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory record not found for this product")

    inv.low_stock_threshold = threshold
    await db.commit()

    return {
        "detail": "Low stock threshold updated",
        "product_id": product_id,
        "low_stock_threshold": threshold,
        "current_quantity": inv.quantity,
    }


@router.post("/{product_id}/adjust")
async def adjust_stock(
    product_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_merchant_id: Optional[str] = Header(default=None, alias="X-Merchant-ID"),
    x_client_id: Optional[str] = Header(default=None, alias="X-Client-ID"),
):
    """
    Adjust stock by a delta (positive = add, negative = remove).
    Or set absolute quantity via set_to field.
    Body: {"delta": 10} or {"set_to": 50}
    """
    merchant_id, client_id = get_tenant_context(request, x_merchant_id, x_client_id)

    body = await request.json()
    delta = body.get("delta")
    set_to = body.get("set_to")

    from sqlalchemy import select
    from app.models.inventory import Inventory

    result = await db.execute(
        select(Inventory).where(
            Inventory.merchant_id == merchant_id,
            Inventory.client_id == client_id,
            Inventory.product_id == product_id,
        ).with_for_update()
    )
    inv = result.scalar_one_or_none()

    if not inv:
        # Create inventory record if it doesn't exist
        inv = Inventory(
            merchant_id=merchant_id,
            client_id=client_id,
            product_id=product_id,
            quantity=0,
        )
        db.add(inv)

    if set_to is not None:
        if not isinstance(set_to, int) or set_to < 0:
            raise HTTPException(status_code=400, detail="set_to must be a non-negative integer")
        inv.quantity = set_to
    elif delta is not None:
        new_qty = inv.quantity + int(delta)
        if new_qty < 0:
            raise HTTPException(status_code=400, detail="Stock cannot go below zero")
        inv.quantity = new_qty
    else:
        raise HTTPException(status_code=400, detail="Provide either delta or set_to")

    await db.commit()

    return {
        "detail": "Stock adjusted",
        "product_id": product_id,
        "quantity": inv.quantity,
    }
