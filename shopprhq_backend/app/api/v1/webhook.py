# app/api/v1/webhook.py

import json
import os
import hmac
import hashlib
import logging

from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import PlainTextResponse

from app.core.tenant_resolver import resolve_tenant_by_phone_number_id
from app.orchestrators.whatsapp_handler import handle_whatsapp_message
from app.core.redis_client import seen_wamid, redis_service
from app.db.session import AsyncSessionLocal
from app.core.request_context import request_id_var  # INF-5: request correlation

router = APIRouter()
logger = logging.getLogger(__name__)

META_VERIFY_TOKEN = os.getenv("META_VERIFY_TOKEN")


# ==================================================
# META VERIFY ENDPOINT
# ==================================================

@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(..., alias="hub.mode"),
    hub_verify_token: str = Query(..., alias="hub.verify_token"),
    hub_challenge: str = Query(..., alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == META_VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge)

    raise HTTPException(status_code=403)


# ==================================================
# SIGNATURE VERIFICATION HELPER
# ==================================================

def _verify_meta_signature(raw_body: bytes, signature_header: str) -> bool:
    """
    Verify the X-Hub-Signature-256 header that Meta sends on every webhook.
    Fails open if META_APP_SECRET is not configured.
    """
    app_secret = os.getenv("META_APP_SECRET", "")

    if not app_secret:
        logger.error(
            "META_APP_SECRET not set — rejecting webhook request. "
            "Set this env var to enable signature verification."
        )
        return False  # fail-closed: reject all requests when secret is missing

    if not signature_header:
        logger.warning("Webhook received with no X-Hub-Signature-256 header")
        return False

    if not signature_header.startswith("sha256="):
        logger.warning("Unexpected signature format: %s", signature_header[:20])
        return False

    expected = hmac.new(
        app_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    received = signature_header[7:]
    return hmac.compare_digest(expected, received)


# ==================================================
# WHATSAPP MAIN WEBHOOK
# ==================================================

@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Responsibilities:
    - X-Hub-Signature-256 verification (Meta security)
    - Atomic WAMID deduplication (Redis)
    - Audio/voice-note special reply (warm, not generic)
    - Other non-text message reply (generic)
    - Tenant resolution
    - First-time customer detection → welcome + name prompt
    - Name capture mode (awaiting_name)
    - Safe forwarding to orchestrator
    - Never crash webhook endpoint
    """

    raw_body = await request.body()

    if not raw_body:
        return {"status": "empty"}

    # INF-5: set a short request_id for this inbound webhook — threads through all log calls
    import uuid as _uuid
    _req_id = str(_uuid.uuid4())[:8]
    request_id_var.set(_req_id)
    logger.info("Webhook received request_id=%s", _req_id)

    # ==================================================
    # SIGNATURE VERIFICATION
    # ==================================================
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_meta_signature(raw_body, signature):
        logger.error("Webhook signature mismatch — rejecting request")
        try:
            import asyncio
            from app.infrastructure.alerting.slack import alert
            asyncio.create_task(alert(
                title="Webhook Signature Mismatch",
                detail="An inbound webhook failed signature verification.",
                level="warning",
                fields={
                    "IP":        request.client.host if request.client else "unknown",
                    "Signature": signature[:40] + "..." if len(signature) > 40 else signature or "none",
                },
            ))
        except Exception:
            pass
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(raw_body.decode())
    except json.JSONDecodeError:
        logger.error("Invalid JSON payload")
        return {"status": "invalid_json"}

    entries = payload.get("entry", [])
    if not entries:
        return {"status": "no_entries"}

    for entry in entries:

        changes = entry.get("changes", [])
        if not changes:
            continue

        for change in changes:

            value = change.get("value", {})

            # Ignore delivery/read receipts
            if "statuses" in value:
                continue

            messages = value.get("messages", [])
            if not messages:
                continue

            metadata        = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")

            if not phone_number_id:
                logger.warning("Missing phone_number_id")
                continue

            message_data = messages[0]

            wamid       = message_data.get("id")
            from_number = message_data.get("from")

            if not wamid or not from_number:
                continue

            from_number = from_number.replace("+", "").strip()

            # ==================================================
            # WAMID DEDUP (ATOMIC)
            # ==================================================
            try:
                is_new = await seen_wamid(wamid)
            except Exception as e:
                logger.exception("Redis failure during dedup: %s", e)
                continue

            if not is_new:
                continue

            # ==================================================
            # PER-SENDER RATE LIMIT  (SEC-3)
            # 10 messages per minute per phone number to block
            # flood attacks before they reach the DB pool.
            # ==================================================
            try:
                _rl_client = await redis_service.get_client()
                _rl_key    = f"wa:inbound_rate:{from_number}"
                _rl_count  = await _rl_client.incr(_rl_key)
                if _rl_count == 1:
                    await _rl_client.expire(_rl_key, 60)  # 1-minute sliding window
                if _rl_count > 10:
                    logger.warning(
                        "Per-sender rate limit exceeded for %s (%d msgs/min) — dropping",
                        from_number, _rl_count,
                    )
                    continue
            except Exception as _rl_err:
                logger.warning("Inbound rate-limit check failed (non-fatal): %s", _rl_err)
                # fail open — never drop a legitimate message on a Redis blip

            msg_type = message_data.get("type", "text")

            # ==================================================
            # NON-TEXT MESSAGE HANDLING
            # Audio/voice notes get a warm, specific reply.
            # All other non-text types get the generic reply.
            # ==================================================

            if msg_type != "text":
                logger.info(
                    "Non-text message type=%s from=%s",
                    msg_type, from_number,
                )

                try:
                    async with AsyncSessionLocal() as db:
                        tenant_context = await resolve_tenant_by_phone_number_id(
                            db, phone_number_id
                        )
                except Exception:
                    logger.exception("Tenant resolution failed for non-text reply")
                    continue

                if tenant_context:
                    from app.services.whatsapp_sender import send_whatsapp_message
                    from app.conversation.humanizer import Humanizer

                    if msg_type == "audio":
                        reply = Humanizer.voice_note_reply()
                    else:
                        reply = (
                            "I'm sorry, I can only read text messages right now. "
                            "Could you type what you need? 😊"
                        )

                    try:
                        await send_whatsapp_message(
                            to_number=from_number,
                            message=reply,
                            phone_number_id=phone_number_id,
                        )
                    except Exception:
                        logger.exception("Failed to send non-text reply")
                continue

            # ==================================================
            # TENANT RESOLUTION
            # ==================================================
            try:
                async with AsyncSessionLocal() as db:
                    tenant_context = await resolve_tenant_by_phone_number_id(
                        db, phone_number_id
                    )
            except Exception as e:
                logger.exception("Tenant resolution failed: %s", e)
                continue

            if not tenant_context:
                logger.error("No tenant found for phone_number_id: %s", phone_number_id)
                continue

            # ==================================================
            # FIRST-TIME / NAME CAPTURE
            #
            # We check CustomerProfile BEFORE handing off to the
            # main orchestrator. This keeps onboarding self-contained
            # here and means the orchestrator can always assume the
            # customer has a name (or is in the process of giving one).
            # ==================================================

            user_text = message_data.get("text", {}).get("body", "").strip()

            try:
                async with AsyncSessionLocal() as db:
                    async with db.begin():
                        from app.services.customer_context import CustomerContextService
                        from app.conversation.memory import ConversationMemory
                        from app.services.whatsapp_sender import send_whatsapp_message
                        from app.conversation.humanizer import Humanizer

                        ctx_svc = CustomerContextService()
                        profile = await ctx_svc.touch_profile(
                            db=db,
                            phone_number=from_number,
                        )

                        memory = await ConversationMemory.load(
                            str(tenant_context.client_id),
                            from_number,
                        )
                        current_mode = await memory.get_mode()

                        # ── Mode: awaiting_name ──────────────────────────────
                        # Customer was asked for their name on a previous turn.
                        # Their current message IS the name — save it and welcome.
                        if current_mode == "awaiting_name":
                            raw_name = user_text.strip()[:100]  # enforce max length
                            # Strip filler phrases customers naturally include
                            _PREFIXES = (
                                "call me ", "my name is ", "i am ", "i'm ",
                                "it's ", "they call me ", "just call me ", "name is ",
                            )
                            _raw_lower = raw_name.lower()
                            for _pfx in _PREFIXES:
                                if _raw_lower.startswith(_pfx):
                                    raw_name = raw_name[len(_pfx):].strip()
                                    break
                            # Take only the first word if multi-word (avoids "Shaddie Nelson Jr")
                            # but keep full name if it's clearly just a name (≤ 2 words, no verb)
                            _words = raw_name.split()
                            if len(_words) > 2:
                                raw_name = _words[0]
                            elif len(_words) == 2:
                                raw_name = raw_name  # e.g. "John Paul" — keep both
                            # Capitalise first letter only; strip trailing punctuation
                            raw_name = raw_name.rstrip(".,!?").strip()
                            name = raw_name[0].upper() + raw_name[1:] if raw_name else user_text.strip()
                            # Persist to DB profile
                            await ctx_svc.save_name(
                                db=db,
                                phone_number=from_number,
                                name=name,
                            )
                            # Sync to Redis session
                            await memory.set_customer_name(name)
                            await memory.set_mode("idle")

                            store_name = tenant_context.client_name or tenant_context.client_id
                            welcome    = Humanizer.name_saved(name, store_name)

                            await send_whatsapp_message(
                                to_number=from_number,
                                message=welcome,
                                phone_number_id=phone_number_id,
                            )
                            # Do not fall through to the orchestrator —
                            # the welcome message is the response for this turn.
                            continue

                        # ── First-time customer ──────────────────────────────
                        # FLOW-12: name capture is now opportunistic — we no longer
                        # block the customer's first message behind a name prompt.
                        # Instead we let the message fall through to the orchestrator
                        # and set a session flag so it can prompt lightly after the
                        # first successful product add.  This avoids the drop-off
                        # that happens when a customer's opening product search is
                        # answered with "what's your name?".
                        is_first_time = CustomerContextService.is_first_time(profile)

                        # Only show the first-time welcome once — guard with memory flag
                        already_welcomed = await memory.get("welcomed", False)

                        if is_first_time and not already_welcomed:
                            await memory.set("welcomed", True)
                            # Mark as first-time so the orchestrator knows to prompt
                            # for name after the first successful add — not right now.
                            await memory.set("pending_name_prompt", True)
                            # Fall through — do NOT continue; let the message reach
                            # the orchestrator so the customer gets their answer first.

                        # ── Returning customer — sync name to session if missing ─
                        # Covers the case where Redis TTL expired but DB has the name.
                        session_name = await memory.get_customer_name()
                        if not session_name and profile and profile.is_named:
                            await memory.set_customer_name(profile.name)

                        # ── Repeat-order prompt ──────────────────────────────
                        # If a returning customer greets the bot AND their last
                        # order was from this same store, offer a one-tap repeat.
                        # Only show once per session (guard with memory flag) and
                        # only on a greeting/hello — not mid-conversation.
                        if (
                            profile
                            and profile.is_named
                            and not already_welcomed
                            and user_text.strip().lower() in {
                                "hi", "hello", "hey", "good morning",
                                "good afternoon", "good evening", "heyy",
                            }
                        ):
                            last_order = profile.get_last_order()
                            if (
                                last_order
                                and profile.last_order_client_id == str(tenant_context.client_id)
                            ):
                                already_offered = await memory.get("repeat_order_offered", False)
                                if not already_offered:
                                    await memory.set("repeat_order_offered", True)
                                    items_text = ", ".join(
                                        f"{i['qty']}x {i['name']}"
                                        for i in last_order.get("items", [])[:3]
                                    )
                                    total_str = f"₦{last_order['total']:,.0f}"
                                    repeat_msg = (
                                        f"Welcome back, {profile.name}! 👋\n\n"
                                        f"Your last order was: *{items_text}* — {total_str}\n\n"
                                        f"Want the same again? Reply *repeat* or just tell me what you need."
                                    )
                                    await send_whatsapp_message(
                                        to_number=from_number,
                                        message=repeat_msg,
                                        phone_number_id=phone_number_id,
                                    )
                                    # Store pending repeat context in session
                                    await memory.set("pending_repeat_order", last_order)
                                    continue

            except Exception:
                logger.exception(
                    "Customer profile / first-time check failed for %s", from_number
                )
                # Non-fatal — fall through to the main orchestrator

            # ==================================================
            # FORWARD TO ORCHESTRATOR
            # ==================================================
            try:
                await handle_whatsapp_message(
                    tenant=tenant_context,
                    message_data=message_data,
                    phone_number_id=phone_number_id,
                )
            except Exception as e:
                logger.exception(
                    "Message handling failed for WAMID %s: %s", wamid, e
                )
                continue

    return {"status": "received"}
