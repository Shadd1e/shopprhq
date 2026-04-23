# app/schemas/flutterwave_subaccount.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SubaccountRegisterRequest(BaseModel):
    """Request body to register a Flutterwave subaccount for a store."""
    account_bank: str = Field(..., description="Flutterwave bank code e.g. '044' for Access Bank")
    account_number: str = Field(..., description="Store's bank account number")
    business_name: str = Field(..., description="Store trading name")
    split_value: Optional[str] = Field(
        None,
        description="Platform fee as percentage e.g. '2.5' or flat amount e.g. '500'"
    )
    split_type: Optional[str] = Field(
        "percentage",
        description="'percentage' or 'flat'"
    )


class SubaccountRead(BaseModel):
    client_id: str
    merchant_id: str
    subaccount_id: str
    account_bank: str
    account_number: str
    business_name: str
    split_value: Optional[str]
    split_type: Optional[str]
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
