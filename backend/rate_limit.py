"""Simple in-memory sliding-window rate limiter for LLM-calling endpoints."""
import time
from collections import defaultdict
from fastapi import Request
from fastapi.responses import JSONResponse

# Endpoints that trigger LLM calls — these are the expensive ones
LLM_ENDPOINTS = {
    "/simulate": True,       # POST /{world_id}/simulate
    "/simulate/stream": True, # POST /{world_id}/simulate/stream
    "/intervene": True,
    "/chronicle": True,
    "/chat": True,            # character chat
    "/council": True,
    "/campaign-kit": True,
    "/session-prep": True,
    "/agent/start": True,
}

# Rate limit config
WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 30  # 30 LLM-heavy requests per minute per IP

# Sliding window storage: ip -> list of timestamps
_request_log: dict[str, list[float]] = defaultdict(list)
_last_global_cleanup: float = 0.0


def _is_llm_endpoint(path: str) -> bool:
    """Check if a path ends with an LLM-calling endpoint suffix."""
    for suffix in LLM_ENDPOINTS:
        if path.endswith(suffix):
            return True
    return False


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
        and _is_llm_endpoint(request.url.path)
    ):
        ip = (request.headers.get("x-forwarded-for", "").split(",")[0].strip()
              or (request.client.host if request.client else "unknown"))
        now = time.monotonic()
        _cleanup_old_entries(ip, now)

        if len(_request_log[ip]) >= MAX_REQUESTS_PER_WINDOW:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit exceeded. Max {MAX_REQUESTS_PER_WINDOW} LLM requests per minute.",
                },
            )

        _request_log[ip].append(now)

    return await call_next(request)
