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
    password: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")

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
        None, min_length=4, max_length=4, pattern=r"^\d{4}$"
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
class MerchantLogin(BaseModel):
    merchant_id: str
    password:    str
