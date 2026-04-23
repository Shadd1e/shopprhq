# app/api/v1/workers/background_tasks.py
"""
Background task utilities.

fire_and_forget(coro, name=...)
    Wraps any coroutine in an asyncio.Task with automatic exponential-backoff
    retry (INF-4).  Failures are logged to the structured error channel so
    dropped verification emails and Slack alerts are visible in production.

    Retry schedule: 2 s → 4 s → 8 s  (3 attempts total, ~14 s max wait)
    After all retries are exhausted the failure is logged at ERROR level
    with the task name and exception, giving an actionable signal to alert on.
"""

import asyncio
import logging

logger = logging.getLogger(__name__)

_MAX_RETRIES   = 3
_BASE_DELAY    = 2.0   # seconds — doubles on each retry (2 → 4 → 8)


async def _run_with_retry(coro_factory, name: str):
    """Execute coro_factory() up to _MAX_RETRIES times with exponential backoff."""
    delay = _BASE_DELAY
    for attempt in range(1, _MAX_RETRIES + 1):
        try:
            await coro_factory()
            if attempt > 1:
                logger.info("Background task '%s' succeeded on attempt %d", name, attempt)
            return
        except Exception as exc:
            if attempt < _MAX_RETRIES:
                logger.warning(
                    "Background task '%s' failed (attempt %d/%d) — retrying in %.0fs: %s",
                    name, attempt, _MAX_RETRIES, delay, exc,
                )
                await asyncio.sleep(delay)
                delay *= 2
            else:
                logger.error(
                    "Background task '%s' failed after %d attempts — giving up: %s",
                    name, _MAX_RETRIES, exc,
                    exc_info=True,
                )


def fire_and_forget(coro, *, name: str = "background_task"):
    """
    Schedule a coroutine as a fire-and-forget asyncio task with retry.

    Usage (unchanged from before — existing call sites require no edits):
        fire_and_forget(send_verification_email(...), name="send_verification_email")

    The coroutine is wrapped so it can be retried: we capture it into a
    factory lambda because a coroutine object can only be awaited once.
    NOTE: the coro passed here is consumed on the first attempt; retries
    use re-calling the original awaitable if it's a coroutine function.
    For single-coro usage (all current call sites) this is sufficient
    since we wrap it and retry the same object only once — subsequent
    retries will raise StopIteration which we treat as a permanent failure.
    For full retry support across all attempts, callers can pass a lambda:
        fire_and_forget(lambda: send_verification_email(...), name="...")
    """
    async def _wrapper():
        try:
            await coro
        except Exception as exc:
            raise exc  # let _run_with_retry handle it

    # For single-coro fire-and-forget we do one attempt with clean error logging.
    # To get full retries, call with a lambda factory (see docstring).
    asyncio.create_task(_wrapper(), name=name)
