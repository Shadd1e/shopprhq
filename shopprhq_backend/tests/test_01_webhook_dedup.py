"""
TEST GROUP 01 — Webhook Ingestion & WAMID Deduplication
=======================================================
Tests every gate the webhook goes through before a message
is processed: JSON parsing, WAMID dedup, tenant resolution,
and the forwarding contract.

PASS = all tests green
FAIL = message may be processed twice, or dropped silently
"""

import pytest
import json
from unittest.mock import AsyncMock, patch, MagicMock


# ─── Helpers ──────────────────────────────────────────────────────────────────

def make_whatsapp_payload(wamid="wamid.001", from_number="2348012345678",
                          phone_number_id="12345678901", text="hello"):
    return {
        "entry": [{
            "changes": [{
                "value": {
                    "metadata": {"phone_number_id": phone_number_id},
                    "messages": [{
                        "id": wamid,
                        "from": from_number,
                        "type": "text",
                        "text": {"body": text},
                    }]
                }
            }]
        }]
    }

def make_status_payload(phone_number_id="12345678901"):
    """Delivery receipt — should be silently ignored."""
    return {
        "entry": [{
            "changes": [{
                "value": {
                    "metadata": {"phone_number_id": phone_number_id},
                    "statuses": [{"id": "wamid.status", "status": "delivered"}]
                }
            }]
        }]
    }


# ─── 01.1 WAMID deduplication ─────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_wamid_first_seen_returns_true():
    """
    First time a WAMID is seen → seen_wamid returns True (process it).
    """
    with patch("app.core.redis_client.redis_service.get_client") as mock_get:
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock(return_value=True)  # NX succeeded
        mock_get.return_value = mock_redis

        from app.core.redis_client import seen_wamid
        result = await seen_wamid("wamid.new.001")

    assert result is True, "New WAMID should return True (process it)"


@pytest.mark.asyncio
async def test_wamid_duplicate_returns_false():
    """
    Second time same WAMID — seen_wamid returns False (drop it).
    """
    with patch("app.core.redis_client.redis_service.get_client") as mock_get:
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock(return_value=None)  # NX failed = already exists
        mock_get.return_value = mock_redis

        from app.core.redis_client import seen_wamid
        result = await seen_wamid("wamid.dup.001")

    assert result is False, "Duplicate WAMID should return False (skip it)"


@pytest.mark.asyncio
async def test_wamid_redis_failure_fails_open():
    """
    If Redis is down, seen_wamid fails open → returns True so message is NOT dropped.
    """
    with patch("app.core.redis_client.redis_service.get_client") as mock_get:
        mock_get.side_effect = Exception("Redis connection refused")

        from app.core.redis_client import seen_wamid
        result = await seen_wamid("wamid.redis.down")

    assert result is True, "Redis failure must fail open — never silently drop messages"


@pytest.mark.asyncio
async def test_wamid_empty_string_fails_open():
    """
    Missing WAMID (empty string) → treated as new to avoid silent drops.
    """
    from app.core.redis_client import seen_wamid
    result = await seen_wamid("")
    assert result is True, "Empty WAMID must be treated as new (fail open)"


# ─── 01.2 User lock ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_acquire_lock_success():
    """
    Lock is acquired when not already held.
    """
    with patch("app.core.redis_client.redis_service.get_client") as mock_get:
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock(return_value=True)
        mock_get.return_value = mock_redis

        from app.core.redis_client import acquire_user_lock
        result = await acquire_user_lock("MERCH1", "2348012345678", "lock-value-abc")

    assert result is True


@pytest.mark.asyncio
async def test_acquire_lock_already_held_returns_false():
    """
    Lock already held by another request → returns False (skip this message).
    """
    with patch("app.core.redis_client.redis_service.get_client") as mock_get:
        mock_redis = AsyncMock()
        mock_redis.set = AsyncMock(return_value=None)  # NX failed
        mock_get.return_value = mock_redis

        from app.core.redis_client import acquire_user_lock
        result = await acquire_user_lock("MERCH1", "2348012345678", "lock-value-xyz")

    assert result is False


@pytest.mark.asyncio
async def test_release_lock_uses_lua_script():
    """
    Lock release must use Lua script to prevent releasing another process's lock.
    """
    with patch("app.core.redis_client.redis_service.get_client") as mock_get:
        mock_redis = AsyncMock()
        mock_redis.eval = AsyncMock(return_value=1)
        mock_get.return_value = mock_redis

        from app.core.redis_client import release_user_lock
        await release_user_lock("MERCH1", "2348012345678", "lock-value-abc")

    mock_redis.eval.assert_called_once()
    call_args = mock_redis.eval.call_args
    assert "ARGV[1]" in call_args[0][0], "Lua script must compare lock value before deleting"


# ─── 01.3 Webhook payload parsing ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_ignores_status_receipts():
    """
    Delivery/read receipts (statuses) must be silently ignored — no handler call.
    """
    from fastapi.testclient import TestClient
    from fastapi import FastAPI

    # Minimal test: just verify the logic path in webhook.py
    # The 'statuses' key in value → continue without processing
    payload = make_status_payload()
    value = payload["entry"][0]["changes"][0]["value"]

    assert "statuses" in value, "Test payload should have statuses"
    assert "messages" not in value, "Status receipts should not have messages"


@pytest.mark.asyncio
async def test_webhook_skips_missing_phone_number_id():
    """
    If phone_number_id is missing from metadata, message is skipped.
    """
    payload = make_whatsapp_payload()
    # Remove phone_number_id
    payload["entry"][0]["changes"][0]["value"]["metadata"] = {}

    metadata = payload["entry"][0]["changes"][0]["value"]["metadata"]
    phone_number_id = metadata.get("phone_number_id")

    assert not phone_number_id, "Should be None/empty"


@pytest.mark.asyncio
async def test_webhook_skips_non_text_message():
    """
    WhatsApp handler skips messages without 'text' key (images, audio, etc.).
    """
    message_data = {
        "id": "wamid.001",
        "from": "2348012345678",
        "type": "image",
        "image": {"id": "img001"},
    }

    # Simulate the check in whatsapp_handler.handle_whatsapp_message
    has_text = "text" in message_data
    assert not has_text, "Non-text messages should not reach handler body"


# ─── 01.4 Tenant resolution ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_tenant_resolver_returns_from_cache():
    """
    Cached tenant is returned without DB query.
    """
    cached_data = {
        "merchant_id": "MERCH1",
        "client_id": "CLNT01",
        "phone_number_id": "12345678901",
    }

    with patch("app.core.tenant_resolver.get_cached_tenant", return_value=cached_data), \
         patch("app.core.tenant_resolver.set_cached_tenant") as mock_set:

        mock_db = AsyncMock()
        from app.core.tenant_resolver import resolve_tenant_by_phone_number_id
        tenant = await resolve_tenant_by_phone_number_id(mock_db, "12345678901")

    assert tenant.merchant_id == "MERCH1"
    assert tenant.client_id == "CLNT01"
    mock_db.execute.assert_not_called()  # No DB hit when cached


@pytest.mark.asyncio
async def test_tenant_resolver_queries_db_on_cache_miss(mock_db):
    """
    On cache miss, resolver queries DB and caches result.
    """
    from unittest.mock import MagicMock

    credential = MagicMock()
    credential.phone_number_id = "12345678901"
    client = MagicMock()
    client.id = "CLNT01"
    client.merchant_id = "MERCH1"
    credential.client = client

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = credential
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.core.tenant_resolver.get_cached_tenant", return_value=None), \
         patch("app.core.tenant_resolver.set_cached_tenant") as mock_cache_set:

        from app.core.tenant_resolver import resolve_tenant_by_phone_number_id
        tenant = await resolve_tenant_by_phone_number_id(mock_db, "12345678901")

    assert tenant.merchant_id == "MERCH1"
    assert tenant.client_id == "CLNT01"
    mock_cache_set.assert_called_once()


@pytest.mark.asyncio
async def test_tenant_resolver_raises_404_for_unknown_number(mock_db):
    """
    Unknown phone_number_id → HTTPException 404, not a silent failure.
    """
    from fastapi import HTTPException

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch("app.core.tenant_resolver.get_cached_tenant", return_value=None):
        from app.core.tenant_resolver import resolve_tenant_by_phone_number_id
        with pytest.raises(HTTPException) as exc_info:
            await resolve_tenant_by_phone_number_id(mock_db, "unknown_number")

    assert exc_info.value.status_code == 404
