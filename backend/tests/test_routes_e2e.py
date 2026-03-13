"""End-to-end route tests: world creation → simulation → intervention → agent."""

import sys
import os
import shutil
import pytest
from unittest.mock import patch, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "tmp_test_e2e_data")
os.environ["DATA_DIR"] = TEST_DATA_DIR
os.environ["TELEGRAM_BOT_TOKEN"] = ""

import store
store.DATA_DIR = TEST_DATA_DIR

# Patch telegram bot creation before importing main
with patch("telegram_bot.create_bot", return_value=None):
    from main import app

from httpx import AsyncClient, ASGITransport


def _cleanup():
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR)


@pytest.fixture(autouse=True)
def cleanup_after():
    yield
    _cleanup()


# -- Mock LLM responses for generation --

MOCK_WORLD_GEOGRAPHY = {
    "regions": [
        {"id": "r1", "name": "Ironhold", "type": "mountains", "climate": "temperate", "x": 0.3, "y": 0.3, "controlled_by": ""},
        {"id": "r2", "name": "Verdant Vale", "type": "forest", "climate": "tropical", "x": 0.7, "y": 0.7, "controlled_by": ""},
    ],
    "connections": [{"from_region": "r1", "to_region": "r2"}],
}

MOCK_FACTIONS = [
    {"id": "f1", "name": "Iron Legion", "ideology": "militaristic", "color": "#cc0000",
     "territory": ["r1"], "population": 500, "morale": 70},
    {"id": "f2", "name": "Green Covenant", "ideology": "pacifist", "color": "#00cc00",
     "territory": ["r2"], "population": 400, "morale": 65},
]

MOCK_CHARACTERS = [
    {"id": "c1", "name": "Commander Vex", "faction_id": "f1", "role": "leader", "location": "r1",
     "genome": {"courage": 0.8, "cunning": 0.6, "loyalty": 0.7, "ambition": 0.5, "empathy": 0.3, "resilience": 0.9}, "fitness": 0.7},
    {"id": "c2", "name": "Elder Moss", "faction_id": "f2", "role": "leader", "location": "r2",
     "genome": {"courage": 0.4, "cunning": 0.8, "loyalty": 0.9, "ambition": 0.3, "empathy": 0.8, "resilience": 0.6}, "fitness": 0.6},
]


@pytest.mark.asyncio
async def test_health_endpoint():
    """GET /api/health returns ok."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_create_world_and_list():
    """POST /api/worlds creates a world, GET /api/worlds lists it."""
    import json

    # Mock LLM calls in generator
    call_count = 0
    async def mock_chat(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:  # geography
            return json.dumps(MOCK_WORLD_GEOGRAPHY)
        elif call_count == 2:  # factions
            return json.dumps(MOCK_FACTIONS)
        elif call_count == 3:  # characters
            return json.dumps(MOCK_CHARACTERS)
        elif call_count == 4:  # prophecies
            return json.dumps([])
        elif call_count == 5:  # world rules
            return json.dumps({"theme": "test", "magic_level": "low", "tech_level": "medieval", "conflict_driver": "resources", "special_rules": []})
        return json.dumps({})

    mock_fn = AsyncMock(side_effect=mock_chat)
    with patch("generator.chat_completion", mock_fn):
        with patch("generator.extract_json", side_effect=lambda raw: json.loads(raw)):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post("/api/worlds", json={"seed": "e2e_test"})

    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert data["name"] != ""
    world_id = data["id"]

    # List should include it
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/worlds")
    assert resp.status_code == 200
    worlds = resp.json()
    assert any(w["id"] == world_id for w in worlds)


@pytest.mark.asyncio
async def test_simulate_quick_produces_events():
    """POST /simulate/quick creates events and advances day."""
    from models.world import World, WorldRules
    from models.geography import Geography, Region, Connection
    from models.faction import Faction
    from models.character import Character
    from models.genome import Genome

    world = World(
        id="e2e_sim_test", name="E2E Sim", seed="e2e",
        geography=Geography(
            regions=[
                Region(id="r1", name="North", type="plains", climate="temperate", x=0.3, y=0.2, controlled_by="f1"),
                Region(id="r2", name="South", type="desert", climate="arid", x=0.7, y=0.8, controlled_by="f2"),
            ],
            connections=[Connection(from_region="r1", to_region="r2")],
        ),
        factions=[
            Faction(id="f1", name="Alphas", ideology="expansionist", color="#ff0000", territory=["r1"], population=1000, morale=70),
            Faction(id="f2", name="Betas", ideology="isolationist", color="#0000ff", territory=["r2"], population=800, morale=60),
        ],
        characters=[
            Character(id="c1", name="Lord A", faction_id="f1", role="leader", location="r1",
                      genome=Genome(courage=0.9, cunning=0.7, loyalty=0.8, ambition=0.6, empathy=0.3, resilience=0.8), fitness=0.7),
            Character(id="c2", name="Duke B", faction_id="f2", role="leader", location="r2",
                      genome=Genome(courage=0.5, cunning=0.9, loyalty=0.6, ambition=0.9, empathy=0.4, resilience=0.5), fitness=0.6),
        ],
        rules=WorldRules(theme="test"), status="ready",
    )
    store.save_world(world)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/worlds/e2e_sim_test/simulate/quick?days=3")

    assert resp.status_code == 200
    data = resp.json()
    assert data["current_day"] == 3
    assert len(data["events"]) > 0


@pytest.mark.asyncio
async def test_god_mode_intervention_sets_user_triggered():
    """POST /intervene creates event with user_triggered=True, agent_triggered=False."""
    import json
    from models.world import World, WorldRules
    from models.geography import Geography, Region, Connection
    from models.faction import Faction
    from models.character import Character
    from models.genome import Genome

    world = World(
        id="e2e_godmode", name="God Mode Test", seed="god",
        geography=Geography(
            regions=[Region(id="r1", name="North", type="plains", climate="temperate", x=0.3, y=0.2, controlled_by="f1")],
            connections=[],
        ),
        factions=[Faction(id="f1", name="Alphas", ideology="neutral", color="#ff0000", territory=["r1"], population=500, morale=70)],
        characters=[
            Character(id="c1", name="Lord A", faction_id="f1", role="leader", location="r1",
                      genome=Genome(courage=0.9, cunning=0.7, loyalty=0.8, ambition=0.6, empathy=0.3, resilience=0.8), fitness=0.7),
        ],
        rules=WorldRules(theme="test"), status="ready", current_day=5,
    )
    store.save_world(world)

    llm_response = json.dumps({
        "title": "Divine Storm",
        "description": "A storm ravages the north",
        "narrative": "Thunder echoed across the mountains.",
        "actors": ["c1"],
        "factions_involved": ["f1"],
        "regions_affected": ["r1"],
        "effects": {
            "morale_changes": {"f1": -5},
            "casualties": {},
            "character_deaths": [],
            "territory_changes": {},
        },
    })

    with patch("routes.worlds.chat_completion", new_callable=AsyncMock, return_value=llm_response):
        with patch("routes.worlds.extract_json", return_value=json.loads(llm_response)):
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                resp = await client.post(
                    "/api/worlds/e2e_godmode/intervene",
                    json={"command": "Unleash a divine storm"},
                )

    assert resp.status_code == 200
    data = resp.json()
    assert data["event"]["agent_triggered"] is False
    assert data["event"]["user_triggered"] is True
    assert data["event"]["type"] == "divine_intervention"
    assert data["event"]["title"] == "Divine Storm"


@pytest.mark.asyncio
async def test_world_not_found_returns_404():
    """Endpoints return 404 for non-existent world IDs."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/worlds/nonexistent_world_12345")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_world():
    """DELETE /api/worlds/{id} removes a world."""
    from models.world import World, WorldRules
    from models.geography import Geography

    world = World(
        id="e2e_delete_test", name="Delete Me", seed="del",
        geography=Geography(), rules=WorldRules(theme="test"), status="ready",
    )
    store.save_world(world)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Confirm it exists
        resp = await client.get("/api/worlds/e2e_delete_test")
        assert resp.status_code == 200

        # Delete
        resp = await client.delete("/api/worlds/e2e_delete_test")
        assert resp.status_code == 200

        # Confirm gone
        resp = await client.get("/api/worlds/e2e_delete_test")
        assert resp.status_code == 404
