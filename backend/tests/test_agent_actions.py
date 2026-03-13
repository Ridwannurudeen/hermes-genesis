"""Tests for autonomous agent actions in autonomous_agent.py."""

import sys
import os
import json
import pytest
from unittest.mock import patch, AsyncMock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["DATA_DIR"] = os.path.join(os.path.dirname(__file__), "tmp_test_agent_data")

from models.world import World, WorldRules
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character
from models.genome import Genome
from models.event import Event
import store

store.DATA_DIR = os.environ["DATA_DIR"]


def _make_world():
    """Minimal world for agent tests."""
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
        id="world_agent_test", name="Agent Test World", seed="agent",
        geography=Geography(regions=regions, connections=[Connection(from_region="r1", to_region="r2")]),
        factions=factions, characters=characters,
        rules=WorldRules(theme="test"), status="ready",
    )


def _cleanup():
    import shutil
    test_dir = os.environ["DATA_DIR"]
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)


# -- Tests for _apply_focus_bias --

def test_apply_focus_bias_high_urgency_lowers_morale():
    """Focus bias with high urgency reduces target faction morale by 15."""
    from autonomous_agent import _apply_focus_bias

    world = _make_world()
    store.save_world(world)
    original_morale = world.factions[0].morale  # f1 = 70

    decision = {
        "focus_faction": "f1",
        "urgency": "high",
    }
    _apply_focus_bias(world, decision)

    assert world.factions[0].morale == original_morale - 15
    _cleanup()


def test_apply_focus_bias_medium_urgency_lowers_morale():
    """Focus bias with medium urgency reduces target faction morale by 8."""
    from autonomous_agent import _apply_focus_bias

    world = _make_world()
    store.save_world(world)
    original_morale = world.factions[0].morale

    decision = {
        "focus_faction": "f1",
        "urgency": "medium",
    }
    _apply_focus_bias(world, decision)

    assert world.factions[0].morale == original_morale - 8
    _cleanup()


def test_apply_focus_bias_boosts_character_fitness():
    """Focus bias on a character boosts their fitness by 0.15."""
    from autonomous_agent import _apply_focus_bias

    world = _make_world()
    store.save_world(world)
    original_fitness = world.characters[0].fitness  # c1 = 0.7

    decision = {
        "focus_character": "c1",
    }
    _apply_focus_bias(world, decision)

    assert world.characters[0].fitness == min(1.0, original_fitness + 0.15)
    _cleanup()


def test_apply_focus_bias_morale_floor_zero():
    """Focus bias cannot push morale below 0."""
    from autonomous_agent import _apply_focus_bias

    world = _make_world()
    world.factions[0].morale = 5  # very low
    store.save_world(world)

    decision = {
        "focus_faction": "f1",
        "urgency": "high",  # would subtract 15
    }
    _apply_focus_bias(world, decision)

    assert world.factions[0].morale == 0
    _cleanup()


def test_apply_focus_bias_fitness_cap_one():
    """Focus bias cannot push character fitness above 1.0."""
    from autonomous_agent import _apply_focus_bias

    world = _make_world()
    world.characters[0].fitness = 0.95
    store.save_world(world)

    decision = {
        "focus_character": "c1",
    }
    _apply_focus_bias(world, decision)

    assert world.characters[0].fitness == 1.0
    _cleanup()


# -- Tests for _get_last_action_consequences --

def test_get_last_action_consequences_empty_when_no_logs():
    """Returns empty string when no agent logs exist."""
    from autonomous_agent import _get_last_action_consequences, _agent_logs

    world = _make_world()
    # Ensure clean state
    _agent_logs.pop("world_agent_test", None)
    world.agent_logs = []

    result = _get_last_action_consequences(world, "world_agent_test")
    assert result == ""


def test_get_last_action_consequences_format():
    """Consequence feedback includes Action, Decision, and event titles."""
    from autonomous_agent import _get_last_action_consequences, _agent_logs

    world = _make_world()
    _agent_logs["world_agent_test"] = [{
        "action": "intervene",
        "day": 5,
        "decision": "Create a dramatic event",
        "intervention_command": "Unleash a plague",
        "event_titles": ["Plague of the North", "Mass Exodus"],
    }]

    result = _get_last_action_consequences(world, "world_agent_test")

    assert "Action: intervene" in result
    assert "Decision: Create a dramatic event" in result
    assert "Command: Unleash a plague" in result
    assert "Plague of the North" in result
    assert "Mass Exodus" in result

    # Cleanup
    _agent_logs.pop("world_agent_test", None)


def test_get_last_action_consequences_shows_deaths():
    """Consequence feedback includes death events that happened after the agent action."""
    from autonomous_agent import _get_last_action_consequences, _agent_logs

    world = _make_world()
    _agent_logs["world_agent_test"] = [{
        "action": "simulate",
        "day": 5,
        "decision": "Run naturally",
        "event_titles": [],
    }]
    # Add a death event after day 5
    world.events.append(Event(
        id="evt_005_death_c1", day=5, type="death",
        title="Lord Alpha has fallen", actors=["c1"],
        factions_involved=["f1"], regions_affected=["r1"],
    ))

    result = _get_last_action_consequences(world, "world_agent_test")

    assert "Deaths since your action" in result
    assert "Lord Alpha has fallen" in result

    _agent_logs.pop("world_agent_test", None)


def test_get_last_action_consequences_falls_back_to_persisted():
    """When in-memory logs are empty, falls back to world.agent_logs."""
    from autonomous_agent import _get_last_action_consequences, _agent_logs

    world = _make_world()
    _agent_logs.pop("world_agent_test", None)
    world.agent_logs = [{
        "action": "focus",
        "day": 3,
        "decision": "Focus on Northerners",
        "event_titles": ["Northern March"],
    }]

    result = _get_last_action_consequences(world, "world_agent_test")

    assert "Action: focus" in result
    assert "Northern March" in result


# -- Tests for _build_observation --

def test_build_observation_includes_world_info():
    """Observation prompt includes world name, day, factions, and characters."""
    from autonomous_agent import _build_observation

    world = _make_world()
    world.current_day = 10

    obs = _build_observation(world)

    assert "Agent Test World" in obs
    assert "Day 10" in obs
    assert "Northerners" in obs
    assert "Southerners" in obs
    assert "Lord Alpha" in obs


def test_build_observation_includes_consequences():
    """When world_id is provided and logs exist, observation includes CONSEQUENCES section."""
    from autonomous_agent import _build_observation, _agent_logs

    world = _make_world()
    world.current_day = 10

    _agent_logs["world_agent_test"] = [{
        "action": "intervene",
        "day": 9,
        "decision": "Triggered a war",
        "event_titles": ["Great War"],
    }]

    obs = _build_observation(world, world_id="world_agent_test")

    assert "CONSEQUENCES OF YOUR LAST ACTION" in obs
    assert "Action: intervene" in obs
    assert "Reflect on whether your last action achieved what you intended" in obs

    _agent_logs.pop("world_agent_test", None)


# -- Tests for _execute_intervention --

@pytest.mark.asyncio
async def test_execute_intervention_marks_agent_triggered():
    """Events created by _execute_intervention have agent_triggered=True."""
    from autonomous_agent import _execute_intervention

    world = _make_world()
    world.current_day = 5
    store.save_world(world)

    llm_response = json.dumps({
        "type": "divine_intervention",
        "title": "The Sky Cracks Open",
        "description": "A rift tears across the sky",
        "narrative": "The heavens split asunder as divine will manifests.",
        "actors": ["c1"],
        "factions_involved": ["f1"],
        "regions_affected": ["r1"],
        "effects": {
            "morale_changes": {"f1": -10},
            "casualties": {},
            "character_deaths": [],
            "territory_changes": {},
        },
    })

    with patch("autonomous_agent.chat_completion", new_callable=AsyncMock, return_value=llm_response):
        with patch("autonomous_agent.extract_json", return_value=json.loads(llm_response)):
            decision = {"intervention_command": "Crack the sky open"}
            events, updated_world = await _execute_intervention(world, decision)

    assert len(events) == 1
    assert events[0].agent_triggered is True
    assert events[0].type == "divine_intervention"
    assert events[0].title == "The Sky Cracks Open"
    # Day should have been incremented
    assert updated_world.current_day == 6
    # Morale effect applied
    f1 = next(f for f in updated_world.factions if f.id == "f1")
    assert f1.morale == 60  # 70 - 10

    _cleanup()


@pytest.mark.asyncio
async def test_execute_intervention_applies_character_deaths():
    """_execute_intervention applies character deaths from effects."""
    from autonomous_agent import _execute_intervention

    world = _make_world()
    world.current_day = 5
    store.save_world(world)

    llm_response = json.dumps({
        "type": "divine_intervention",
        "title": "Divine Smite",
        "description": "A character is struck down",
        "narrative": "Lightning from the heavens.",
        "actors": ["c2"],
        "factions_involved": ["f2"],
        "regions_affected": ["r2"],
        "effects": {
            "morale_changes": {},
            "casualties": {},
            "character_deaths": ["c2"],
            "territory_changes": {},
        },
    })

    with patch("autonomous_agent.chat_completion", new_callable=AsyncMock, return_value=llm_response):
        with patch("autonomous_agent.extract_json", return_value=json.loads(llm_response)):
            decision = {"intervention_command": "Strike down Duke Beta"}
            events, updated_world = await _execute_intervention(world, decision)

    c2 = next(c for c in updated_world.characters if c.id == "c2")
    assert c2.alive is False

    _cleanup()


# -- Tests for agent log persistence --

def test_agent_log_persistence():
    """Agent logs append to world.agent_logs and in-memory _agent_logs."""
    from autonomous_agent import _agent_logs

    world = _make_world()

    # Simulate what agent_tick does when logging
    log_entry = {
        "day": 5,
        "action": "simulate",
        "decision": "Let it run",
        "reasoning": "Tensions building",
        "events_generated": 2,
        "event_titles": ["Battle A", "Alliance B"],
    }

    world.agent_logs.append(log_entry)
    assert len(world.agent_logs) == 1
    assert world.agent_logs[-1]["action"] == "simulate"
    assert world.agent_logs[-1]["event_titles"] == ["Battle A", "Alliance B"]

    # In-memory store
    wid = "world_agent_test"
    if wid not in _agent_logs:
        _agent_logs[wid] = []
    _agent_logs[wid].append(log_entry)
    assert len(_agent_logs[wid]) >= 1
    assert _agent_logs[wid][-1]["day"] == 5

    _agent_logs.pop(wid, None)
