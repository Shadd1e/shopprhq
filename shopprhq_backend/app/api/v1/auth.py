from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.services.merchant_service import MerchantService
from app.core.security import create_access_token
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
import logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate merchant and return access token.
    """
    service = MerchantService(db)
    merchant = await service.authenticate(data.email, data.password)

    if not merchant:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(subject=merchant.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "merchant_id": merchant.id,
        "name": merchant.name,
        "email": merchant.email,
        "email_verified": getattr(merchant, "email_verified", False),
    }