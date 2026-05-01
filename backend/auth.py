import hashlib
import hmac
import secrets
import time
from fastapi import Request

import config


def _secret() -> str:
    return config.API_KEY or ""


def is_admin_key(key: str | None) -> bool:
    secret = _secret()
    return bool(secret and key and hmac.compare_digest(key, secret))


def _sign(payload: str) -> str:
    return hmac.new(_secret().encode("utf-8"), payload.encode("utf-8"), hashlib.sha256).hexdigest()


def create_admin_session(now: int | None = None) -> str:
    if not _secret():
        raise RuntimeError("GENESIS_API_KEY is required for admin sessions")
    ts = str(now or int(time.time()))
    nonce = secrets.token_urlsafe(24)
    payload = f"{ts}:{nonce}"
    return f"{payload}.{_sign(payload)}"


def is_admin_session(token: str | None, now: int | None = None) -> bool:
    if not _secret() or not token:
        return False
    try:
        payload, sig = token.rsplit(".", 1)
        ts_raw, _nonce = payload.split(":", 1)
        ts = int(ts_raw)
    except (ValueError, TypeError):
        return False
    expected = _sign(payload)
    if not hmac.compare_digest(sig, expected):
        return False
    age = (now or int(time.time())) - ts
    return 0 <= age <= config.ADMIN_SESSION_TTL_SECONDS


def is_admin_credentials(x_api_key: str | None = None, session_token: str | None = None) -> bool:
    if not _secret():
        return True
    return is_admin_key(x_api_key) or is_admin_session(session_token)


def request_is_admin(request: Request) -> bool:
    return is_admin_credentials(
        request.headers.get("X-API-Key"),
        request.cookies.get(config.ADMIN_SESSION_COOKIE),
    )
