"""Tests for prophecy fulfillment checking in prophecy_checker.py."""

import sys
import os
import json
import pytest
from unittest.mock import patch, AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.world import World, WorldRules, Prophecy
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character
from models.genome import Genome
from models.event import Event
from prophecy_checker import (
    check_prophecy_fulfillment,
    check_and_fulfill_prophecies,
    PROPHECY_CHECK_SYSTEM,
)


def _make_world_with_prophecies():
    """Minimal world with prophecies for testing."""
    regions = [
        Region(id="r1", name="North", type="plains", climate="temperate", x=0.3, y=0.2, controlled_by="f1"),
    ]
    factions = [
        Faction(id="f1", name="Northerners", ideology="expansionist", color="#ff0000", territory=["r1"], population=1000, morale=70),
    ]
    characters = [
        Character(id="c1", name="Lord Alpha", faction_id="f1", role="leader", location="r1",
                  genome=Genome(courage=0.9, cunning=0.7, loyalty=0.8, ambition=0.6, empathy=0.3, resilience=0.8), fitness=0.7),
    ]
    prophecies = [
        Prophecy(id="p1", text="The north shall fall to fire", hint="A natural disaster strikes the north"),
        Prophecy(id="p2", text="Two kings unite", hint="An alliance between two factions", fulfilled=True, fulfilled_day=2),
    ]
    world = World(
        id="world_prophecy_test", name="Prophecy Test World", seed="prophecy",
        geography=Geography(regions=regions, connections=[]),
        factions=factions, characters=characters,
        rules=WorldRules(theme="test"), status="ready",
        prophecies=prophecies,
    )
    return world


def _make_events(day=3):
    """Create sample events for prophecy checking."""
    return [
        Event(id=f"evt_{day:03d}_01", day=day, type="military_conflict",
              title="Battle of the Plains", narrative="A fierce battle raged in the northern plains."),
        Event(id=f"evt_{day:03d}_02", day=day, type="natural_disaster",
              title="Great Fire of the North", narrative="Fire consumed the northern territories."),
    ]


def test_prophecy_check_system_prompt_exists():
    """PROPHECY_CHECK_SYSTEM is a non-empty string."""
    assert isinstance(PROPHECY_CHECK_SYSTEM, str)
    assert len(PROPHECY_CHECK_SYSTEM) > 50
    assert "prophecy" in PROPHECY_CHECK_SYSTEM.lower() or "prophecies" in PROPHECY_CHECK_SYSTEM.lower()


@pytest.mark.asyncio
async def test_already_fulfilled_skipped():
    """Prophecy with fulfilled=True returns None immediately, no LLM call."""
    prophecy = Prophecy(id="p2", text="Already done", fulfilled=True, fulfilled_day=2)
    recent = [{"day": 3, "type": "battle", "title": "Some event"}]

    # If the LLM were called, this would raise an error -- proving it's skipped
    result = await check_prophecy_fulfillment(prophecy, recent, "Test World")
    assert result is None


@pytest.mark.asyncio
async def test_check_and_fulfill_creates_event():
    """When LLM says fulfilled with high confidence, prophecy is marked and event created."""
    world = _make_world_with_prophecies()
    events = _make_events(day=3)
    # Add events to world so recent lookup works
    world.events.extend(events)

    llm_response = json.dumps({
        "fulfilled": True,
        "confidence": 0.8,
        "explanation": "The great fire destroyed the north",
    })

    with patch("prophecy_checker.chat_completion", new_callable=AsyncMock, return_value=llm_response):
        with patch("prophecy_checker.extract_json", return_value=json.loads(llm_response)):
            fulfillment_events = await check_and_fulfill_prophecies(world, events, day=3)

    # p1 should now be fulfilled
    p1 = next(p for p in world.prophecies if p.id == "p1")
    assert p1.fulfilled is True
    assert p1.fulfilled_day == 3

    # A fulfillment event should have been created
    assert len(fulfillment_events) >= 1
    fe = fulfillment_events[0]
    assert fe.type == "prophecy_fulfilled"
    assert "Prophecy Fulfilled" in fe.title
    assert fe.day == 3


@pytest.mark.asyncio
async def test_low_confidence_not_fulfilled():
    """When LLM returns low confidence (< 0.6), prophecy is NOT fulfilled."""
    world = _make_world_with_prophecies()
    events = _make_events(day=3)
    world.events.extend(events)

    llm_response = json.dumps({
        "fulfilled": True,
        "confidence": 0.4,
        "explanation": "Maybe, but not really",
    })

    with patch("prophecy_checker.chat_completion", new_callable=AsyncMock, return_value=llm_response):
        with patch("prophecy_checker.extract_json", return_value=json.loads(llm_response)):
            fulfillment_events = await check_and_fulfill_prophecies(world, events, day=3)

    # p1 should still be unfulfilled
    p1 = next(p for p in world.prophecies if p.id == "p1")
    assert p1.fulfilled is False
    assert len(fulfillment_events) == 0


@pytest.mark.asyncio
async def test_only_checks_every_3_days():
    """Prophecies are only checked on days divisible by 3."""
    world = _make_world_with_prophecies()
    events = _make_events(day=1)
    world.events.extend(events)

    # Day 1 -- should skip (not divisible by 3)
    # If LLM were called, the mock would need to be set up -- but it shouldn't be called
    fulfillment_events = await check_and_fulfill_prophecies(world, events, day=1)
    assert len(fulfillment_events) == 0

    # Day 2 -- should skip
    fulfillment_events = await check_and_fulfill_prophecies(world, events, day=2)
    assert len(fulfillment_events) == 0

    # Day 3 -- should check (mock the LLM to return not-fulfilled to avoid side effects)
    llm_response = json.dumps({
        "fulfilled": False,
        "confidence": 0.2,
        "explanation": "Not yet",
    })

    with patch("prophecy_checker.chat_completion", new_callable=AsyncMock, return_value=llm_response):
        with patch("prophecy_checker.extract_json", return_value=json.loads(llm_response)):
            fulfillment_events = await check_and_fulfill_prophecies(world, events, day=3)

    # No fulfillment, but the LLM WAS called (we got past the day check)
    assert len(fulfillment_events) == 0


@pytest.mark.asyncio
async def test_no_unfulfilled_prophecies_skips():
    """If all prophecies are fulfilled, returns empty list immediately."""
    world = _make_world_with_prophecies()
    # Mark all prophecies as fulfilled
    for p in world.prophecies:
        p.fulfilled = True
        p.fulfilled_day = 1

    events = _make_events(day=3)
    world.events.extend(events)

    fulfillment_events = await check_and_fulfill_prophecies(world, events, day=3)
    assert len(fulfillment_events) == 0


@pytest.mark.asyncio
async def test_no_events_skips():
    """If no new events, returns empty list immediately."""
    world = _make_world_with_prophecies()

    fulfillment_events = await check_and_fulfill_prophecies(world, new_events=[], day=3)
    assert len(fulfillment_events) == 0


@pytest.mark.asyncio
async def test_llm_exception_handled_gracefully():
    """If LLM call raises an exception, prophecy stays unfulfilled and no crash."""
    world = _make_world_with_prophecies()
    events = _make_events(day=3)
    world.events.extend(events)

    with patch("prophecy_checker.chat_completion", new_callable=AsyncMock, side_effect=Exception("API down")):
        fulfillment_events = await check_and_fulfill_prophecies(world, events, day=3)

    p1 = next(p for p in world.prophecies if p.id == "p1")
    assert p1.fulfilled is False
    assert len(fulfillment_events) == 0
