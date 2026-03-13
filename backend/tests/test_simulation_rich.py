"""Smoke tests for simulation_rich.py shared helper."""

import sys
import os
import shutil
import pytest
from unittest.mock import patch, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

TEST_DATA_DIR = os.path.join(os.path.dirname(__file__), "tmp_test_rich_data")
os.environ["DATA_DIR"] = TEST_DATA_DIR

import store
store.DATA_DIR = TEST_DATA_DIR

from models.world import World, WorldRules
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character
from models.genome import Genome


def _cleanup():
    if os.path.exists(TEST_DATA_DIR):
        shutil.rmtree(TEST_DATA_DIR)


def _make_world():
    return World(
        id="rich_test", name="Rich Test", seed="rich",
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


@pytest.mark.asyncio
async def test_simulate_rich_tick_returns_events():
    """simulate_rich_tick returns world, events list, and prophecy data."""
    from simulation_rich import simulate_rich_tick

    world = _make_world()
    store.save_world(world)

    # Mock LLM calls (narrator, obituary, prophecy checker)
    with patch("simulation_rich.chat_completion", new_callable=AsyncMock, return_value="A dramatic event unfolded."):
        with patch("simulation_rich.check_and_fulfill_prophecies", new_callable=AsyncMock, return_value=[]):
            result_world, events, pf_data = await simulate_rich_tick("rich_test")

    assert result_world is not None
    assert result_world.current_day == 1
    assert len(events) > 0
    assert pf_data is None  # no prophecies to fulfill
    _cleanup()


@pytest.mark.asyncio
async def test_simulate_rich_tick_nonexistent_world():
    """simulate_rich_tick returns None tuple for missing world."""
    from simulation_rich import simulate_rich_tick

    world, events, pf_data = await simulate_rich_tick("nonexistent_999")
    assert world is None
    assert events == []
    assert pf_data is None
    _cleanup()


@pytest.mark.asyncio
async def test_simulate_rich_tick_generates_narratives():
    """simulate_rich_tick calls LLM for narrative generation on non-death events."""
    from simulation_rich import simulate_rich_tick

    world = _make_world()
    store.save_world(world)

    mock_llm = AsyncMock(return_value="The battle raged across the northern plains.")

    with patch("simulation_rich.chat_completion", mock_llm):
        with patch("simulation_rich.check_and_fulfill_prophecies", new_callable=AsyncMock, return_value=[]):
            result_world, events, _ = await simulate_rich_tick("rich_test")

    # At least one non-death event should have gotten a narrative call
    non_death = [e for e in events if e.type != "death"]
    if non_death:
        assert mock_llm.call_count >= 1
    _cleanup()


@pytest.mark.asyncio
async def test_simulate_rich_tick_handles_llm_failure():
    """simulate_rich_tick gracefully handles LLM errors."""
    from simulation_rich import simulate_rich_tick

    world = _make_world()
    store.save_world(world)

    mock_llm = AsyncMock(side_effect=Exception("LLM unavailable"))

    with patch("simulation_rich.chat_completion", mock_llm):
        with patch("simulation_rich.check_and_fulfill_prophecies", new_callable=AsyncMock, return_value=[]):
            result_world, events, _ = await simulate_rich_tick("rich_test")

    # Should still succeed — events generated even if narrative fails
    assert result_world is not None
    assert len(events) > 0
    _cleanup()
