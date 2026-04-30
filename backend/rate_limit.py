"""Simple in-memory sliding-window rate limiter for LLM-calling endpoints."""
import os
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse

# IPs we trust to set X-Forwarded-For honestly (the reverse proxy that fronts us).
# Default to the loopback range — nginx running on the same host will hit us via
# 127.0.0.1. Override via TRUSTED_PROXY_IPS env var (comma-separated) when
# fronted by a non-loopback proxy.
_TRUSTED_PROXY_IPS = {ip.strip() for ip in os.getenv("TRUSTED_PROXY_IPS", "127.0.0.1,::1").split(",") if ip.strip()}

# Endpoints that trigger LLM calls — these are the expensive ones
LLM_ENDPOINT_LIMITS = {
    "/worlds": 6,
    "/worlds/stream": 6,
    "/regen/stream": 3,
    "/submit": 6,
    "/simulate": 12,
    "/simulate/stream": 12,
    "/simulate/quick": 20,
    "/intervene": 12,
    "/chronicle": 10,
    "/chat": 20,
    "/council": 10,
    "/campaign-kit": 8,
    "/session-prep": 8,
    "/agent/start": 6,
    "/scene-image": 10,
    "/images/render": 10,
    "/audio/render": 10,
}

# Rate limit config
WINDOW_SECONDS = 60
DEFAULT_MAX_REQUESTS_PER_WINDOW = 30

# Sliding window storage: ip -> list of timestamps
_request_log: dict[str, list[float]] = defaultdict(list)
_last_global_cleanup: float = 0.0


def _limit_for_path(path: str) -> int | None:
    """Return the per-window limit for an LLM-calling endpoint, if any."""
    for suffix, limit in sorted(LLM_ENDPOINT_LIMITS.items(), key=lambda item: len(item[0]), reverse=True):
        if path.endswith(suffix):
            return limit
    return None


def _cleanup_old_entries(ip: str, now: float) -> None:
    """Remove timestamps outside the current window."""
    global _last_global_cleanup
    cutoff = now - WINDOW_SECONDS
    _request_log[ip] = [t for t in _request_log[ip] if t > cutoff]
    if not _request_log[ip]:
        del _request_log[ip]
    # Periodically purge all stale IPs to prevent unbounded memory growth
    if now - _last_global_cleanup > WINDOW_SECONDS * 2:
        _last_global_cleanup = now
        stale = [k for k, v in _request_log.items() if not v or v[-1] < cutoff]
        for k in stale:
            del _request_log[k]


async def rate_limit_middleware(request: Request, call_next):
    """Rate-limit LLM-calling endpoints by client IP."""
    # Only rate-limit POST requests to LLM endpoints under /api/
    if (
        request.method == "POST"
        and request.url.path.startswith("/api/")
        and _limit_for_path(request.url.path) is not None
    ):
        limit = _limit_for_path(request.url.path) or DEFAULT_MAX_REQUESTS_PER_WINDOW
        # Only trust X-Forwarded-For when the request actually came from a proxy
        # we control. Otherwise the header is attacker-controlled and would let
        # any client get a fresh rate-limit bucket per request.
        peer = request.client.host if request.client else "unknown"
        xff = request.headers.get("x-forwarded-for", "")
        if peer in _TRUSTED_PROXY_IPS and xff:
            # Take the leftmost entry (the original client) from the chain.
            ip = xff.split(",")[0].strip() or peer
        else:
            ip = peer
        now = time.monotonic()
        _cleanup_old_entries(ip, now)

        if len(_request_log[ip]) >= limit:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Max {limit} LLM requests per minute.",
                },
            )

        _request_log[ip].append(now)

    return await call_next(request)
