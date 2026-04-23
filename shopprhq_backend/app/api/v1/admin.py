from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import logging

from app.db.session import get_db
from app.models.client_whatsapp_credential import ClientWhatsAppCredential
from app.models.client_model import Client
from app.schemas.client_whatsapp_credential import (
    ClientWhatsAppCredentialCreate,
    ClientWhatsAppCredentialOut,
    ClientWhatsAppCredentialSummary,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/merchant-credentials",
    tags=["WhatsApp Credentials (Admin)"],
)


# -------------------------
# CREATE CREDENTIAL
# -------------------------
@router.post(
    "/",
    response_model=ClientWhatsAppCredentialOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_credential(
    payload: ClientWhatsAppCredentialCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Verify client belongs to merchant
    res = await db.execute(
        select(Client).where(
            Client.id == payload.client_id,
            Client.merchant_id == merchant_id,
        )
    )
    if not res.scalars().first():
        raise HTTPException(
            status_code=404,
            detail="Client not found under this merchant",
        )

    # Enforce unique phone_number_id
    dup = await db.execute(
        select(ClientWhatsAppCredential).where(
            ClientWhatsAppCredential.phone_number_id == payload.phone_number_id
        )
    )
    if dup.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="phone_number_id already registered",
        )

    credential = ClientWhatsAppCredential(
        client_id=payload.client_id,
        phone_number_id=payload.phone_number_id,
        whatsapp_number=payload.whatsapp_number,
        active=True,
    )

    db.add(credential)
    await db.commit()
    await db.refresh(credential)

    logger.info(
        "WhatsApp credential created",
        extra={"merchant_id": merchant_id, "client_id": payload.client_id},
    )

    return credential


# -------------------------
# LIST CREDENTIALS
# -------------------------
@router.get(
    "/",
    response_model=list[ClientWhatsAppCredentialSummary],
)
async def list_credentials(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    res = await db.execute(
        select(ClientWhatsAppCredential)
        .join(Client, ClientWhatsAppCredential.client_id == Client.id)
        .where(Client.merchant_id == merchant_id)
        .order_by(ClientWhatsAppCredential.created_at.desc())
    )

    return res.scalars().all()


# -------------------------
# GET BY CLIENT
# -------------------------
@router.get(
    "/by-client/{client_id}",
    response_model=ClientWhatsAppCredentialOut,
)
async def get_credential_by_client(
    client_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    res = await db.execute(
        select(ClientWhatsAppCredential)
        .join(Client)
        .where(
            ClientWhatsAppCredential.client_id == client_id,
            Client.merchant_id == merchant_id,
        )
    )
    cred = res.scalars().first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    return cred


# -------------------------
# UPDATE (NO TOKENS)
# -------------------------
@router.put(
    "/by-client/{client_id}",
    response_model=ClientWhatsAppCredentialOut,
)
async def update_credential(
    client_id: str,
    payload: ClientWhatsAppCredentialCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    res = await db.execute(
        select(ClientWhatsAppCredential)
        .join(Client)
        .where(
            ClientWhatsAppCredential.client_id == client_id,
            Client.merchant_id == merchant_id,
        )
        .with_for_update()
    )
    cred = res.scalars().first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    cred.phone_number_id = payload.phone_number_id
    cred.whatsapp_number = payload.whatsapp_number
    cred.active = payload.active

    await db.commit()
    await db.refresh(cred)

    return cred


# -------------------------
# DEACTIVATE (SOFT DELETE)
# -------------------------
@router.delete(
    "/by-client/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def deactivate_credential(
    client_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    merchant_id = getattr(request.state, "merchant_id", None)
    if not merchant_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    res = await db.execute(
        select(ClientWhatsAppCredential)
        .join(Client)
        .where(
            ClientWhatsAppCredential.client_id == client_id,
            Client.merchant_id == merchant_id,
        )
        .with_for_update()
    )
    cred = res.scalars().first()
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    cred.active = False
    await db.commit()
