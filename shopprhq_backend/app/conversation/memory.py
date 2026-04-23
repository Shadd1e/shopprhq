# app/conversation/memory.py

from typing import Dict, Any, Optional
from app.core.redis_client import (
    get_session,
    set_session,
    delete_session,
    delete_history,
    add_to_history,
    SESSION_TTL,
)


class ConversationMemory:
    """
    Async Redis-backed conversation memory.
    Uses full-session writes (no atomic field ops).

    Keyed by (client_id, user_phone) — not merchant_id — so that a merchant
    with multiple stores has fully isolated sessions per store. A customer
    messaging Store A and Store B of the same merchant gets separate carts,
    separate conversation state, and separate history.

    IMPORTANT: Both session state AND history are keyed by client_id (store ID),
    not merchant_id. The history must be read with client_id as the namespace key
    to match the keys written here.
    """

    def __init__(self, client_id: str, user_id: str):
        self.client_id = client_id
        self.user_id = user_id
        self.session: Dict[str, Any] = {}

    # ==================================================
    # LOAD
    # ==================================================

    @classmethod
    async def load(cls, client_id: str, user_id: str):
        self = cls(client_id, user_id)
        self.session = await get_session(client_id, user_id)
        return self

    # ==================================================
    # SAVE (FULL SESSION WRITE)
    # ==================================================

    async def _save(self):
        await set_session(self.client_id, self.user_id, self.session)

    # ==================================================
    # MODE
    # ==================================================

    async def get_mode(self) -> str:
        return self.session.get("mode", "idle")

    async def set_mode(self, mode: str):
        self.session["mode"] = mode
        await self._save()

    # ==================================================
    # GENERIC STATE
    # ==================================================

    async def get(self, key: str, default=None):
        return self.session.get(key, default)

    async def set(self, key: str, value):
        self.session[key] = value
        await self._save()

    async def delete(self, key: str):
        self.session.pop(key, None)
        await self._save()

    async def update(self, updates: Dict[str, Any]):
        self.session.update(updates)
        await self._save()

    async def patch(self, updates: Dict[str, Any]):
        """
        Atomic read-modify-write using a Redis Lua script (INF-2).

        The Lua script runs atomically on the Redis server — no other
        client can interleave between the GET and SET.  This prevents
        last-write-wins data loss when two concurrent paths (e.g. a
        WhatsApp message and a Flutterwave webhook) both modify different
        keys of the same session dict simultaneously.
        """
        from app.core.redis_client import get_session as _get_session, redis_service
        import json as _json

        key = f"session:flow:{self.client_id}:{self.user_id}"
        updates_json = _json.dumps(updates)

        lua = """
        local raw = redis.call('GET', KEYS[1])
        local data = {}
        if raw then
            data = cjson.decode(raw)
        end
        local patch = cjson.decode(ARGV[1])
        for k, v in pairs(patch) do
            data[k] = v
        end
        local ttl = tonumber(ARGV[2])
        redis.call('SETEX', KEYS[1], ttl, cjson.encode(data))
        return cjson.encode(data)
        """

        try:
            client = await redis_service.get_client()
            result = await client.eval(lua, 1, key, updates_json, SESSION_TTL)
            self.session = _json.loads(result)
        except Exception:
            # Fallback: non-atomic merge (safe for non-critical fields)
            fresh = await _get_session(self.client_id, self.user_id)
            fresh.update(updates)
            self.session = fresh
            await self._save()

    # ==================================================
    # CHOICES
    # ==================================================

    async def get_choices(self):
        return self.session.get("pending_choices", [])

    async def set_choices(self, choices):
        self.session["pending_choices"] = choices or []
        await self._save()

    async def clear_choices(self):
        self.session.pop("pending_choices", None)
        await self._save()

    # ==================================================
    # TEMP DATA
    # ==================================================

    async def get_temp_data(self, key: str, default=None):
        return self.session.get("temp", {}).get(key, default)

    async def set_temp_data(self, key: str, value: Any):
        temp = self.session.get("temp", {})
        temp[key] = value
        self.session["temp"] = temp
        await self._save()

    async def clear_temp(self):
        """Clear all temp data (pending_product, pending selections, etc.)"""
        self.session.pop("temp", None)
        await self._save()

    # ==================================================
    # INTENT DEDUP
    # ==================================================

    async def seen_intent(self, intent: str) -> bool:
        last = self.session.get("last_intent")
        self.session["last_intent"] = intent
        await self._save()
        return last == intent

    # ==================================================
    # CUSTOMER INFO
    # ==================================================

    async def get_customer_name(self) -> Optional[str]:
        return self.session.get("customer_name")

    async def set_customer_name(self, name: str):
        self.session["customer_name"] = name
        await self._save()

    # ==================================================
    # LAST SEARCH
    # ==================================================

    async def get_last_search(self) -> Optional[str]:
        return self.session.get("last_search")

    async def set_last_search(self, query: str):
        self.session["last_search"] = query
        await self._save()

    # ==================================================
    # HISTORY
    # NOTE: add_to_history uses self.client_id as the namespace key.
    # whatsapp_handler must read history with the same client_id key —
    # NOT merchant_id — to ensure reads and writes use the same Redis key.
    # ==================================================

    async def add_user(self, text: str):
        await add_to_history(
            client_id=self.client_id,
            user_id=self.user_id,
            role="user",
            content=text,
        )

    async def add_assistant(self, text: str):
        await add_to_history(
            client_id=self.client_id,
            user_id=self.user_id,
            role="assistant",
            content=text,
        )

    # ==================================================
    # RESET
    # Clears both session state AND conversation history so
    # a fresh start is truly clean — old history won't bias
    # the next session's DeepSeek classification.
    # ==================================================

    async def clear(self):
        await delete_session(self.client_id, self.user_id)
        await delete_history(self.client_id, self.user_id)
        self.session = {}
