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
from auth import create_admin_session, is_admin_session

with patch("telegram_bot.create_bot", return_value=None):
    import main
    app = main.app

from httpx import AsyncClient, ASGITransport


_TEST_API_KEY = "test-secret-key-xyz"


@pytest.fixture(autouse=True)
def auth_test_env(tmp_path):
    """Per-test: pin DATA_DIR + API_KEY to test values, then restore on teardown
    so other test modules see a clean slate."""
    global TEST_DATA_DIR
    saved_data_dir = store.DATA_DIR
    saved_config_data_dir = config.DATA_DIR
    saved_api_key = config.API_KEY
    saved_test_data_dir = TEST_DATA_DIR
    TEST_DATA_DIR = str(tmp_path / "auth_data")
    store.DATA_DIR = TEST_DATA_DIR
    config.DATA_DIR = TEST_DATA_DIR
    config.API_KEY = _TEST_API_KEY
    os.makedirs(TEST_DATA_DIR, exist_ok=True)
    yield
    current_test_data_dir = TEST_DATA_DIR
    store.DATA_DIR = saved_data_dir
    config.DATA_DIR = saved_config_data_dir
    config.API_KEY = saved_api_key
    TEST_DATA_DIR = saved_test_data_dir
    if os.path.exists(current_test_data_dir):
        shutil.rmtree(current_test_data_dir)


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
async def test_login_sets_admin_session_cookie_and_allows_mutation():
    _write_world_file("world_cookie_001", "Cookie Admin", "s", "unlisted")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/login", json={"api_key": _TEST_API_KEY})
        assert r.status_code == 200
        body = r.json()
        assert body["admin"] is True
        set_cookie = r.headers.get("set-cookie", "")
        assert config.ADMIN_SESSION_COOKIE in set_cookie
        assert "HttpOnly" in set_cookie

        r = await client.patch(
            "/api/worlds/world_cookie_001/visibility",
            json={"visibility": "public"},
        )
        assert r.status_code == 200
        assert r.json()["visibility"] == "public"


@pytest.mark.asyncio
async def test_login_with_wrong_key_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/login", json={"api_key": "wrong-key"})
        assert r.status_code == 403


def test_admin_session_expiry(monkeypatch):
    monkeypatch.setattr(config, "ADMIN_SESSION_TTL_SECONDS", 60)
    token = create_admin_session(now=1_000)
    assert is_admin_session(token, now=1_001) is True
    assert is_admin_session(token, now=1_061) is False


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
async def test_private_world_detail_requires_admin_key():
    _write_world_file("world_prv_002", "Private Direct Link", "sensitive seed", "private")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/worlds/world_prv_002")
        assert r.status_code == 404

        r = await client.get(
            "/api/worlds/world_prv_002",
            headers={"X-API-Key": _TEST_API_KEY},
        )
        assert r.status_code == 200
        assert r.json()["id"] == "world_prv_002"


@pytest.mark.asyncio
async def test_private_world_detail_accepts_admin_session_cookie():
    _write_world_file("world_prv_cookie_001", "Private Cookie", "sensitive seed", "private")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/auth/login", json={"api_key": _TEST_API_KEY})
        assert r.status_code == 200

        r = await client.get("/api/worlds/world_prv_cookie_001")
        assert r.status_code == 200
        assert r.json()["id"] == "world_prv_cookie_001"


@pytest.mark.asyncio
async def test_private_world_subresources_require_admin_key():
    _write_world_file("world_prv_003", "Private Subresources", "sensitive seed", "private")
    paths = [
        "/api/worlds/world_prv_003/map",
        "/api/worlds/world_prv_003/factions",
        "/api/worlds/world_prv_003/characters",
        "/api/worlds/world_prv_003/events",
        "/api/worlds/world_prv_003/prophecies",
        "/api/worlds/world_prv_003/evolution",
        "/api/worlds/world_prv_003/faction-timeline",
        "/api/worlds/world_prv_003/export",
        "/api/worlds/world_prv_003/agent/status",
        "/api/worlds/world_prv_003/agent/logs",
    ]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for path in paths:
            r = await client.get(path)
            assert r.status_code == 404, path

            r = await client.get(path, headers={"X-API-Key": _TEST_API_KEY})
            assert r.status_code == 200, path


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


@pytest.mark.asyncio
async def test_admin_usage_requires_auth_and_accepts_session():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/admin/usage")
        assert r.status_code == 403

        r = await client.post("/api/auth/login", json={"api_key": _TEST_API_KEY})
        assert r.status_code == 200

        r = await client.get("/api/admin/usage")
        assert r.status_code == 200
        body = r.json()
        assert "total_requests" in body
        assert body["total_requests"] >= 1


def test_static_file_resolver_accepts_files_inside_static(tmp_path, monkeypatch):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    asset = static_dir / "app.js"
    asset.write_text("ok", encoding="utf-8")

    monkeypatch.setattr(main, "STATIC_DIR", str(static_dir))

    assert main._resolve_static_file("app.js") == os.path.realpath(str(asset))


def test_static_file_resolver_rejects_prefix_sibling_traversal(tmp_path, monkeypatch):
    static_dir = tmp_path / "static"
    sibling_dir = tmp_path / "static_evil"
    static_dir.mkdir()
    sibling_dir.mkdir()
    (sibling_dir / "secret.txt").write_text("secret", encoding="utf-8")

    monkeypatch.setattr(main, "STATIC_DIR", str(static_dir))

    assert main._resolve_static_file("../static_evil/secret.txt") is None


def test_static_file_resolver_rejects_absolute_paths(tmp_path, monkeypatch):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("secret", encoding="utf-8")

    monkeypatch.setattr(main, "STATIC_DIR", str(static_dir))

    assert main._resolve_static_file(str(secret)) is None
