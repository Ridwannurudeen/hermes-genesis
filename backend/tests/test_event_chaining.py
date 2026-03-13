"""Tests for the event chaining system in simulation.py."""

import sys
import os
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.event import Event, EventOutcome
from models.world import World, WorldRules
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character, Lineage
from models.genome import Genome
from simulation import CHAIN_RULES, _maybe_chain_event


def _make_world():
    """Minimal world with 2 factions and 4 characters for chain tests."""
    regions = [
        Region(id="r1", name="North", type="plains", climate="temperate", x=0.3, y=0.2, controlled_by="f1"),
        Region(id="r2", name="South", type="desert", climate="arid", x=0.7, y=0.8, controlled_by="f2"),
    ]
    factions = [
        Faction(id="f1", name="Northerners", ideology="expansionist", color="#ff0000", territory=["r1"], population=1000, morale=70),
        Faction(id="f2", name="Southerners", ideology="isolationist", color="#0000ff", territory=["r2"], population=800, morale=60),
    ]
    characters = [
        Character(id="c1", name="Lord Alpha", faction_id="f1", role="leader", location="r1",
                  genome=Genome(courage=0.9, cunning=0.7, loyalty=0.8, ambition=0.6, empathy=0.3, resilience=0.8), fitness=0.7),
        Character(id="c2", name="Duke Beta", faction_id="f2", role="leader", location="r2",
                  genome=Genome(courage=0.5, cunning=0.9, loyalty=0.6, ambition=0.9, empathy=0.4, resilience=0.5), fitness=0.6),
        Character(id="c3", name="Spy Gamma", faction_id="f1", role="spy", location="r1",
                  genome=Genome(courage=0.4, cunning=0.95, loyalty=0.3, ambition=0.85, empathy=0.2, resilience=0.6), fitness=0.5),
        Character(id="c4", name="Healer Delta", faction_id="f2", role="healer", location="r2",
                  genome=Genome(courage=0.3, cunning=0.4, loyalty=0.9, ambition=0.2, empathy=0.95, resilience=0.7), fitness=0.5),
    ]
    return World(
        id="world_chain_test", name="Chain Test World", seed="chain",
        geography=Geography(regions=regions, connections=[Connection(from_region="r1", to_region="r2")]),
        factions=factions, characters=characters,
        rules=WorldRules(theme="test"), status="ready",
    )


def test_event_model_causality_fields():
    """Event model supports caused_by, agent_triggered, and prophecy_id fields."""
    event = Event(
        id="evt_001_01",
        day=1,
        type="military_conflict",
        title="Test Battle",
        caused_by="evt_000_01",
        agent_triggered=True,
        prophecy_id="prophecy_01",
    )
    assert event.caused_by == "evt_000_01"
    assert event.agent_triggered is True
    assert event.prophecy_id == "prophecy_01"


def test_event_model_causality_defaults():
    """Event model causality fields default to empty/False."""
    event = Event(id="evt_001_01", day=1, type="test", title="Minimal")
    assert event.caused_by == ""
    assert event.agent_triggered is False
    assert event.prophecy_id == ""


def test_chain_rules_exist():
    """CHAIN_RULES dict has expected event type mappings."""
    assert isinstance(CHAIN_RULES, dict)
    assert "betrayal" in CHAIN_RULES
    assert "military_conflict" in CHAIN_RULES
    assert "succession" in CHAIN_RULES
    assert "alliance" in CHAIN_RULES
    assert "natural_disaster" in CHAIN_RULES
    # Each value is a list of (type, probability) tuples
    for key, rules in CHAIN_RULES.items():
        assert isinstance(rules, list)
        for chain_type, prob in rules:
            assert isinstance(chain_type, str)
            assert 0.0 < prob <= 1.0


def test_chain_event_type_mapping():
    """Verify specific chain event type mappings."""
    betrayal_chains = {t for t, _ in CHAIN_RULES["betrayal"]}
    assert "military_conflict" in betrayal_chains

    military_chains = {t for t, _ in CHAIN_RULES["military_conflict"]}
    assert "succession" in military_chains

    succession_chains = {t for t, _ in CHAIN_RULES["succession"]}
    assert "political_intrigue" in succession_chains

    alliance_chains = {t for t, _ in CHAIN_RULES["alliance"]}
    assert "cultural_shift" in alliance_chains

    disaster_chains = {t for t, _ in CHAIN_RULES["natural_disaster"]}
    assert "military_conflict" in disaster_chains


def test_maybe_chain_event_creates_linked_event():
    """When random triggers a chain, the returned event has caused_by set to parent ID."""
    world = _make_world()
    parent = Event(
        id="evt_005_01",
        day=5,
        type="betrayal",
        title="Betrayal in the court",
        actors=["c1", "c2"],
        factions_involved=["f1", "f2"],
        regions_affected=["r1"],
    )

    # Force random.random() to return 0.0 so it always passes the probability check
    with patch("simulation.random.random", return_value=0.0):
        with patch("simulation.random.choice", side_effect=lambda lst: lst[0]):
            result = _maybe_chain_event(parent, world, day=5, event_counter=1)

    assert result is not None
    assert result.caused_by == "evt_005_01"
    assert result.day == 5
    assert result.id == "evt_005_chain_01"
    # betrayal chains to military_conflict
    assert result.type == "military_conflict"
    assert "(consequence)" in result.title


def test_maybe_chain_event_respects_probability():
    """When random does NOT trigger, None is returned."""
    world = _make_world()
    parent = Event(
        id="evt_005_01",
        day=5,
        type="betrayal",
        title="Betrayal",
        actors=["c1", "c2"],
        factions_involved=["f1", "f2"],
        regions_affected=["r1"],
    )

    # Force random.random() to return 0.99 -- above any chain probability
    with patch("simulation.random.random", return_value=0.99):
        result = _maybe_chain_event(parent, world, day=5, event_counter=1)

    assert result is None


def test_maybe_chain_event_no_rules_for_type():
    """Event types with no chain rules return None immediately."""
    world = _make_world()
    parent = Event(
        id="evt_005_01",
        day=5,
        type="death",  # no chain rules for death
        title="A death",
        actors=["c1"],
        factions_involved=["f1"],
    )

    result = _maybe_chain_event(parent, world, day=5, event_counter=1)
    assert result is None


def test_maybe_chain_event_insufficient_characters():
    """If fewer than 2 alive characters, chain returns None even if probability fires."""
    world = _make_world()
    # Kill all but one character
    for c in world.characters[1:]:
        c.alive = False

    parent = Event(
        id="evt_005_01",
        day=5,
        type="betrayal",
        title="Betrayal",
        actors=["c1"],
        factions_involved=["f1"],
    )

    with patch("simulation.random.random", return_value=0.0):
        result = _maybe_chain_event(parent, world, day=5, event_counter=1)

    assert result is None
