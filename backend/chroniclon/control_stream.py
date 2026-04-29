"""Canon Control Room — pub/sub broker that fans canonization phases to live subscribers.

Each phase of `canonize_event` (decision, writing, anti-slop, fact-check,
cross-link, publish) emits a small event into this broker. The Control Room
SSE route subscribes and streams events to the frontend so the demo can show
a live model-by-model pipeline view.

Lightweight, in-process. If the runner restarts, subscribers will simply pick
up new events from that point. The backlog gives newly-connected UIs the last
~50 phase events so the page is alive within a second of opening.
"""
from __future__ import annotations

import asyncio
from collections import deque
from datetime import datetime
from typing import Any

_BACKLOG_SIZE = 80
_backlog: deque[dict[str, Any]] = deque(maxlen=_BACKLOG_SIZE)

_subscribers: set[asyncio.Queue] = set()
_SUBSCRIBER_QUEUE_MAX = 200


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
