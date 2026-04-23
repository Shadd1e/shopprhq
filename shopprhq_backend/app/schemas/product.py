import logging
logger = logging.getLogger(__name__)

# app/schemas/product.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


# -----------------------------
# Base Schema (shared)
# -----------------------------
class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, example="Indomie Chicken Noodles")
    description: Optional[str] = Field(None, example="Instant noodles, 70g pack")
    price: float = Field(..., gt=0, example=120.00)
    category: Optional[str] = Field(None, example="Food")
    merchant_id: Optional[str] = Field(None, min_length=1, max_length=10, example="MRC001")
    client_id: Optional[str] = Field(None, min_length=1, max_length=10, example="CLT001")

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# Create Schema
# -----------------------------
class ProductCreate(ProductBase):
    id: Optional[UUID] = None
    initial_stock: int = Field(0, ge=0, description="Starting inventory quantity")


# -----------------------------
# Update Schema
# -----------------------------
class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# Read Schema
# -----------------------------
class InventoryInfo(BaseModel):
    """Embedded inventory snapshot on ProductRead."""
    quantity: int = 0
    low_stock_threshold: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)


class ProductRead(ProductBase):
    id: UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    inventory: Optional[InventoryInfo] = None

    model_config = ConfigDict(from_attributes=True)


# -----------------------------
# Search Result Schema
# -----------------------------
class ProductSearchResult(BaseModel):
    product: ProductRead
    score: float

    model_config = ConfigDict(from_attributes=True)
