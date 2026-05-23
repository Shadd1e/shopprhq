from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
import re
import logging

logger = logging.getLogger(__name__)

_PHONE_RE = re.compile(r'^\d{7,15}$')


def _normalise_phone(v: Optional[str]) -> Optional[str]:
    """
    Strip leading +, spaces, and dashes.
    Accepts:  +2348012345678  /  2348012345678  /  08012345678
    Returns:  2348012345678  (digits only, no +)
    Returns None if blank.
    """
    if not v:
        return None
    cleaned = re.sub(r'[\s\-]', '', v).lstrip('+')
    if not _PHONE_RE.match(cleaned):
        raise ValueError(
            "Enter a valid phone number (7–15 digits, optionally starting with +)."
        )
    return cleaned


# ─────────────────────────────────────────────────────────────────────────────
# CREATE — submitted by the merchant on the registration form
# ─────────────────────────────────────────────────────────────────────────────
class MerchantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)  # FIX: was 4-digit PIN only

    # The WhatsApp number the merchant wants to use for their store.
    # Optional at signup — they can add it later — but strongly prompted
    # in the UI so we capture it upfront for admin onboarding.
    whatsapp_number: Optional[str] = Field(
        None,
        description=(
            "Business WhatsApp number to connect (digits only or with leading +). "
            "Must not currently be registered on WhatsApp Business App."
        ),
        examples=["2348012345678", "+2348012345678"],
    )

    @field_validator("whatsapp_number", mode="before")
    @classmethod
    def normalise_whatsapp(cls, v):
        return _normalise_phone(v)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Mama Tee Foods",
                "email": "mama@mamatee.ng",
                "password": "1234",
                "whatsapp_number": "2348012345678",
            }
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# READ — returned to callers; never exposes password_hash
# ─────────────────────────────────────────────────────────────────────────────
class MerchantRead(BaseModel):
    id:               str
    name:             str
    email:            EmailStr
    email_verified:   bool           = False
    waba_active:      bool           = False
    whatsapp_number:  Optional[str]  = None
    created_at:       Optional[datetime] = None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# UPDATE — merchant editing their own profile
# ─────────────────────────────────────────────────────────────────────────────
class MerchantUpdate(BaseModel):
    name:             Optional[str]      = None
    email:            Optional[EmailStr] = None
    password:         Optional[str]      = Field(
        None, min_length=6, max_length=128  # FIX: was 4-digit PIN only
    )
    whatsapp_number:  Optional[str]      = Field(
        None,
        description="Updated business WhatsApp number.",
    )

    @field_validator("whatsapp_number", mode="before")
    @classmethod
    def normalise_whatsapp(cls, v):
        return _normalise_phone(v)


# ─────────────────────────────────────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────────────────────────────────────
# FIX: was merchant_id + password. Backend authenticate() queries by email
# so the schema must match. Frontend updated to send email instead of merchant_id.
class MerchantLogin(BaseModel):
    email:    EmailStr
    password: str


# ─────────────────────────────────────────────────────────────────────────────
# APPLY — submitted by a prospective merchant via the public "Apply to Use" form
# No account is created; this just fires an email to the ShopprHQ team.
# ─────────────────────────────────────────────────────────────────────────────
class MerchantApply(BaseModel):
    # Business info
    business_name:        str  = Field(..., min_length=2, max_length=255)
    business_type:        str  = Field(..., min_length=2, max_length=100,
                                       description="e.g. Food & Beverages, Fashion, Electronics")
    city_state:           str  = Field(..., min_length=2, max_length=150,
                                       description="e.g. Lagos, Nigeria")

    # Applicant info
    full_name:            str  = Field(..., min_length=2, max_length=255)
    email:                EmailStr
    phone_number:         str  = Field(..., description="Applicant's contact phone")
    whatsapp_number:      str  = Field(..., description="WhatsApp number to connect to the store")

    # Operations info
    num_branches:         int  = Field(..., ge=1, le=500,
                                       description="Number of stores/branches")
    monthly_order_volume: str  = Field(..., description="e.g. '<50', '50-200', '200-500', '500+'")
    uses_whatsapp_manual: bool = Field(...,
                                       description="Do you currently take orders on WhatsApp manually?")
    uses_delivery_service:bool = Field(...,
                                       description="Do you use a delivery/logistics service?")

    # Discovery & comments
    heard_about_us:       str  = Field(..., max_length=200,
                                       description="How did you hear about ShopprHQ?")
    comments:             Optional[str] = Field(None, max_length=2000)

    @field_validator("phone_number", "whatsapp_number", mode="before")
    @classmethod
    def normalise_phones(cls, v):
        return _normalise_phone(v)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "business_name":        "Mama Tee Foods",
                "business_type":        "Food & Beverages",
                "city_state":           "Lagos, Nigeria",
                "full_name":            "Temi Adeyemi",
                "email":                "temi@mamatee.ng",
                "phone_number":         "2348012345678",
                "whatsapp_number":      "2348012345678",
                "num_branches":         1,
                "monthly_order_volume": "50-200",
                "uses_whatsapp_manual": True,
                "uses_delivery_service":False,
                "heard_about_us":       "Instagram",
                "comments":             "We run a catering business and want to automate orders.",
            }
        }
    )


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN APPROVE — posted by the ShopprHQ team to manually create a merchant account
# Protected by ADMIN_SECRET.
# ─────────────────────────────────────────────────────────────────────────────
class AdminApproveMerchant(BaseModel):
    # Core account fields
    name:            str      = Field(..., min_length=2, max_length=255,
                                      description="Merchant's full name or business name")
    email:           EmailStr
    whatsapp_number: Optional[str] = Field(
        None,
        description="WhatsApp number to connect (digits only or with leading +).",
    )
    # Optional: if omitted a random secure password is generated and emailed
    initial_password: Optional[str] = Field(
        None, min_length=8, max_length=128,
        description="If omitted, a secure password is auto-generated and emailed to the merchant.",
    )

    @field_validator("whatsapp_number", mode="before")
    @classmethod
    def normalise_whatsapp(cls, v):
        return _normalise_phone(v)
