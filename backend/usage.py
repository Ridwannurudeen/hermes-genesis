import json
import time
from datetime import datetime, timezone
from pathlib import Path
from filelock import FileLock, Timeout
from fastapi import Request

import config


USAGE_FILE = "usage.json"
LOCK_FILE = ".usage.lock"

ESTIMATED_UNITS = {
    "/worlds": 5,
    "/worlds/stream": 5,
    "/regen/stream": 18,
    "/submit": 8,
    "/simulate": 5,
    "/simulate/stream": 5,
    "/simulate/quick": 1,
    "/intervene": 2,
    "/chronicle": 4,
    "/chat": 1,
    "/council": 3,
    "/campaign-kit": 5,
    "/session-prep": 4,
    "/agent/start": 2,
    "/scene-image": 3,
    "/images/render": 3,
    "/audio/render": 3,
}


def _data_dir() -> Path:
    return Path(config.DATA_DIR)


def _usage_path() -> Path:
    return _data_dir() / USAGE_FILE


def _lock_path() -> Path:
    return _data_dir() / LOCK_FILE


def _endpoint_key(path: str) -> str | None:
    for suffix in sorted(ESTIMATED_UNITS, key=len, reverse=True):
        if path.endswith(suffix):
            return suffix
    return None


def _empty() -> dict:
    return {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None,
        "total_requests": 0,
        "total_failures": 0,
        "estimated_model_units": 0,
        "by_endpoint": {},
        "by_day": {},
    }


def _load() -> dict:
    path = _usage_path()
    if not path.exists():
        return _empty()
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return _empty()
        return data
    except (OSError, json.JSONDecodeError):
        return _empty()


def record_usage(method: str, path: str, status_code: int, duration_ms: float) -> None:
    if not path.startswith("/api/"):
        return
    endpoint = _endpoint_key(path)
    if endpoint is None and method == "GET":
        return
    _data_dir().mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(_lock_path()), timeout=2)
    try:
        with lock:
            data = _load()
            now = datetime.now(timezone.utc)
            today = now.date().isoformat()
            units = ESTIMATED_UNITS.get(endpoint or "", 0)
            failed = int(status_code >= 400)

            data["updated_at"] = now.isoformat()
            data["total_requests"] = int(data.get("total_requests", 0)) + 1
            data["total_failures"] = int(data.get("total_failures", 0)) + failed
            data["estimated_model_units"] = int(data.get("estimated_model_units", 0)) + units

            by_endpoint = data.setdefault("by_endpoint", {})
            key = endpoint or path
            row = by_endpoint.setdefault(
                key,
                {"requests": 0, "failures": 0, "estimated_model_units": 0, "avg_ms": 0.0, "last_status": None},
            )
            previous = int(row.get("requests", 0))
            row["requests"] = previous + 1
            row["failures"] = int(row.get("failures", 0)) + failed
            row["estimated_model_units"] = int(row.get("estimated_model_units", 0)) + units
            row["avg_ms"] = round(((float(row.get("avg_ms", 0.0)) * previous) + duration_ms) / row["requests"], 2)
            row["last_status"] = status_code

            by_day = data.setdefault("by_day", {})
            day = by_day.setdefault(today, {"requests": 0, "failures": 0, "estimated_model_units": 0})
            day["requests"] += 1
            day["failures"] += failed
            day["estimated_model_units"] += units

            _usage_path().write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Timeout:
        return


def usage_snapshot() -> dict:
    return _load()


async def usage_middleware(request: Request, call_next):
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    record_usage(request.method, request.url.path, response.status_code, duration_ms)
    return response
