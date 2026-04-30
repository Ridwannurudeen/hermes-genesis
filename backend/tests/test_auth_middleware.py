"""API-key middleware: header-only, never query-param."""

import sys
import os
import shutil
from unittest.mock import patch
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "tmp_test_auth_data")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "")

import config
import store

with patch("telegram_bot.create_bot", return_value=None):
    import main
    app = main.app

from httpx import AsyncClient, ASGITransport


_TEST_API_KEY = "test-secret-key-xyz"


@pytest.fixture(autouse=True)
def auth_test_env():
    """Per-test: pin DATA_DIR + API_KEY to test values, then restore on teardown
    so other test modules see a clean slate."""
    saved_data_dir = store.DATA_DIR
    saved_api_key = config.API_KEY
    store.DATA_DIR = TEST_DATA_DIR
    config.API_KEY = _TEST_API_KEY
    os.makedirs(TEST_DATA_DIR, exist_ok=True)
    yield
    store.DATA_DIR = saved_data_dir
    config.API_KEY = saved_api_key
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR)


@pytest.mark.asyncio
async def test_post_without_key_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/worlds", json={"seed": "x"})
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_post_with_query_param_key_rejected():
    """Query-param api_key must NOT authenticate (header-only)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            f"/api/worlds?api_key={_TEST_API_KEY}",
            json={"seed": "x"},
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_post_with_header_key_accepted():
    """Header-based key passes the gate (further routing/validation may still 4xx)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/worlds",
            json={"seed": "x"},
            headers={"X-API-Key": _TEST_API_KEY},
        )
        # Auth gate passed: not a 403 from middleware. The request may still 4xx
        # for missing/invalid body, but the middleware did not block it.
        assert r.status_code != 403


@pytest.mark.asyncio
async def test_post_with_wrong_header_key_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post(
            "/api/worlds",
            json={"seed": "x"},
            headers={"X-API-Key": "wrong-key"},
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_get_health_does_not_require_key():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["auth_required"] is True


@pytest.mark.asyncio
async def test_submissions_list_requires_admin():
    """The pending moderation queue must NOT be public."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/chronicle/submissions")
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_submissions_list_admin_ok():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get(
            "/api/chronicle/submissions",
            headers={"X-API-Key": _TEST_API_KEY},
        )
        assert r.status_code == 200
        assert "items" in r.json()


@pytest.mark.asyncio
async def test_contributors_is_public():
    """Public list of canonized contributors should not require auth."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/chronicle/contributors")
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert "total" in body


# --------------------------------------------------------------------------- #
#  P1-2: world visibility + seed redaction                                    #
# --------------------------------------------------------------------------- #


def _write_world_file(world_id: str, name: str, seed: str, visibility: str | None) -> None:
    """Write a minimal world JSON to TEST_DATA_DIR for visibility tests."""
    import json as _json
    os.makedirs(TEST_DATA_DIR, exist_ok=True)
    payload = {
        "id": world_id,
        "name": name,
        "seed": seed,
        "current_day": 1,
        "status": "ready",
        "created_at": "2026-04-30T00:00:00+00:00",
        "geography": {"regions": [], "connections": []},
        "factions": [],
        "characters": [],
        "events": [],
        "rules": {},
        "prophecies": [],
        "faction_snapshots": [],
        "agent_logs": [],
    }
    if visibility is not None:
        payload["visibility"] = visibility
    with open(os.path.join(TEST_DATA_DIR, f"{world_id}.json"), "w", encoding="utf-8") as f:
        _json.dump(payload, f)


@pytest.mark.asyncio
async def test_public_list_only_returns_public_visibility():
    _write_world_file("world_pub_001", "Curated Demo", "A safe seed.", "public")
    _write_world_file("world_unl_001", "User Draft", "555-1234 personal note", "unlisted")
    _write_world_file("world_prv_001", "Private Notes", "secret", "private")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/worlds")
        assert r.status_code == 200
        ids = {w["id"] for w in r.json()}
        assert "world_pub_001" in ids
        assert "world_unl_001" not in ids
        assert "world_prv_001" not in ids


@pytest.mark.asyncio
async def test_admin_list_returns_all_worlds():
    _write_world_file("world_pub_002", "Curated", "ok", "public")
    _write_world_file("world_unl_002", "Draft", "555-9999", "unlisted")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get(
            "/api/worlds",
            headers={"X-API-Key": _TEST_API_KEY},
        )
        assert r.status_code == 200
        ids = {w["id"] for w in r.json()}
        assert "world_pub_002" in ids
        assert "world_unl_002" in ids


@pytest.mark.asyncio
async def test_legacy_world_without_visibility_field_treated_as_unlisted():
    _write_world_file("world_legacy_001", "Legacy", "old data", visibility=None)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/worlds")
        assert r.status_code == 200
        ids = {w["id"] for w in r.json()}
        assert "world_legacy_001" not in ids
        # Admin still sees it
        r = await client.get(
            "/api/worlds",
            headers={"X-API-Key": _TEST_API_KEY},
        )
        ids_admin = {w["id"] for w in r.json()}
        assert "world_legacy_001" in ids_admin


@pytest.mark.asyncio
async def test_world_detail_accessible_for_unlisted():
    """Direct-link access still works regardless of visibility."""
    _write_world_file("world_unl_003", "Direct Link", "shareable", "unlisted")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/worlds/world_unl_003")
        assert r.status_code == 200
        assert r.json()["id"] == "world_unl_003"


@pytest.mark.asyncio
async def test_set_visibility_requires_admin():
    _write_world_file("world_promote_001", "Promote", "s", "unlisted")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.patch(
            "/api/worlds/world_promote_001/visibility",
            json={"visibility": "public"},
        )
        assert r.status_code == 403


@pytest.mark.asyncio
async def test_set_visibility_admin_promotes_world():
    _write_world_file("world_promote_002", "Promote", "s", "unlisted")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.patch(
            "/api/worlds/world_promote_002/visibility",
            json={"visibility": "public"},
            headers={"X-API-Key": _TEST_API_KEY},
        )
        assert r.status_code == 200
        assert r.json()["visibility"] == "public"
        # Now appears in public list
        r = await client.get("/api/worlds")
        ids = {w["id"] for w in r.json()}
        assert "world_promote_002" in ids
