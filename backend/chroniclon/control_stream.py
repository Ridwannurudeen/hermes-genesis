"""Canon Control Room — pub/sub broker that fans canonization phases to live subscribers.

Each phase of `canonize_event` (decision, writing, anti-slop, fact-check,
cross-link, publish) emits a small event into this broker. The Control Room
SSE route subscribes and streams events to the frontend so the demo can show
a live model-by-model pipeline view.

Lightweight, in-process per container. The chroniclon-runner runs in a
separate container from the FastAPI service, so its in-memory broker has no
subscribers. To fix this, when ``CONTROL_EMIT_URL`` is set the runner
fan-outs every emission to the API container's ingest endpoint via HTTP;
the API container's broker then serves SSE subscribers.
"""
from __future__ import annotations

import asyncio
import logging
import os
from collections import deque
from datetime import datetime
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_BACKLOG_SIZE = 80
_backlog: deque[dict[str, Any]] = deque(maxlen=_BACKLOG_SIZE)

_subscribers: set[asyncio.Queue] = set()
_SUBSCRIBER_QUEUE_MAX = 200


def _remote_target() -> tuple[str, str] | None:
    """Return (url, key) if cross-container fan-out is configured."""
    url = os.getenv("CONTROL_EMIT_URL", "").strip()
    if not url:
        return None
    key = os.getenv("CONTROL_EMIT_KEY") or os.getenv("GENESIS_API_KEY", "")
    return url, key


async def _fan_out(url: str, key: str, event: dict[str, Any]) -> None:
    """Fire-and-forget POST so the API container's broker receives the event.
    Errors only log at debug — control-room visibility is best-effort."""
    headers = {"Content-Type": "application/json"}
    if key:
        headers["X-API-Key"] = key
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, headers=headers, json=event)
    except Exception as ex:  # noqa: BLE001
        logger.debug(f"control fan-out failed: {ex}")


def emit(event: dict[str, Any]) -> None:
    """Broadcast a phase event. Non-blocking — drops to slow subscribers."""
    enriched = {"ts": datetime.utcnow().isoformat() + "Z", **event}
    _backlog.append(enriched)
    # Iterate over a snapshot — set may mutate as subscribers come and go.
    for q in list(_subscribers):
        try:
            q.put_nowait(enriched)
        except asyncio.QueueFull:
            # Slow consumer — drop rather than block the canon pipeline.
            pass

    # Cross-container fan-out: only schedules a task when an event loop is
    # running (true inside async canon paths) AND CONTROL_EMIT_URL is set.
    target = _remote_target()
    if target is None:
        return
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return  # called from sync context, e.g. tests; skip silently
    url, key = target
    loop.create_task(_fan_out(url, key, enriched))


def ingest_remote(event: dict[str, Any]) -> None:
    """Receive an event posted from a remote process (e.g. the runner) and
    deliver it to local subscribers. Used by the /control/ingest route.

    We trust the upstream timestamp if present so the UI can show actual
    phase timing rather than the moment the API received the post.
    """
    enriched = event if "ts" in event else {"ts": datetime.utcnow().isoformat() + "Z", **event}
    _backlog.append(enriched)
    for q in list(_subscribers):
        try:
            q.put_nowait(enriched)
        except asyncio.QueueFull:
            pass


async def subscribe() -> asyncio.Queue:
    """Open a new subscriber queue and seed it with the recent backlog."""
    q: asyncio.Queue = asyncio.Queue(maxsize=_SUBSCRIBER_QUEUE_MAX)
    for ev in list(_backlog):
        try:
            q.put_nowait(ev)
        except asyncio.QueueFull:
            break
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def backlog_snapshot(limit: int = 50) -> list[dict[str, Any]]:
    """Return the most recent backlog events (REST fallback for non-SSE clients)."""
    items = list(_backlog)
    return items[-limit:]


def stats() -> dict[str, int]:
    return {"subscribers": len(_subscribers), "backlog": len(_backlog)}
