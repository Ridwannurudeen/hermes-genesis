"""Tests for Telegram formatting helpers in telegram_bot.py.

These tests cover pure formatting functions that require no network or bot instance.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Prevent telegram_bot from failing on import due to missing TELEGRAM_BOT_TOKEN
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "")

from models.event import Event
from telegram_bot import (
    _escape_markdown,
    _format_event_block,
    _format_prophecy_fulfilled,
    EVENT_TYPE_EMOJIS,
)


# -- _escape_markdown tests --

def test_escape_markdown_backticks():
    """Backticks are replaced with single quotes."""
    result = _escape_markdown("Use `code` here")
    assert "`" not in result
    assert "Use 'code' here" == result


def test_escape_markdown_square_brackets():
    """Square brackets are replaced with parentheses."""
    result = _escape_markdown("See [link] for details")
    assert "[" not in result
    assert "]" not in result
    assert "See (link) for details" == result


def test_escape_markdown_combined():
    """Backticks and brackets are both escaped in the same string."""
    result = _escape_markdown("Run `cmd` [here]")
    assert result == "Run 'cmd' (here)"


def test_escape_markdown_passthrough():
    """Plain text without special chars passes through unchanged."""
    text = "Hello world, this is normal text."
    assert _escape_markdown(text) == text


def test_escape_markdown_empty_string():
    """Empty string returns empty string."""
    assert _escape_markdown("") == ""


# -- _format_event_block tests --

def test_format_event_block_basic():
    """Event with title and narrative formats with emoji and markdown."""
    event = Event(
        id="evt_001_01", day=1, type="military_conflict",
        title="Battle of the Plains",
        narrative="Swords clashed on the open field as two armies met.",
    )
    result = _format_event_block(event)

    # Should contain the crossed-swords emoji for military_conflict
    assert "\u2694\ufe0f" in result
    # Title should be bold
    assert "*Battle of the Plains*" in result
    # Narrative should be italicized
    assert "_Swords clashed" in result


def test_format_event_block_no_narrative():
    """Event with no narrative or description omits the snippet line."""
    event = Event(
        id="evt_001_01", day=1, type="alliance",
        title="Pact of Peace",
        narrative="",
        description="",
    )
    result = _format_event_block(event)

    # Should have title but no italic snippet
    assert "*Pact of Peace*" in result
    lines = result.strip().split("\n")
    # Only the title line (no narrative line)
    assert len(lines) == 1


def test_format_event_block_truncates_long_narrative():
    """Narratives longer than 150 chars are truncated with ellipsis."""
    long_narrative = "A" * 200
    event = Event(
        id="evt_001_01", day=1, type="discovery",
        title="Great Discovery",
        narrative=long_narrative,
    )
    result = _format_event_block(event)

    assert "..." in result
    # The snippet should contain 150 A's, not 200
    # (inside italics markers)
    assert "A" * 150 in result
    assert "A" * 200 not in result


def test_format_event_block_agent_triggered():
    """Agent-triggered events show the World Master action marker."""
    event = Event(
        id="evt_001_agent_01", day=1, type="divine_intervention",
        title="The Sky Breaks",
        narrative="Divine force reshapes the land.",
        agent_triggered=True,
    )
    result = _format_event_block(event)

    assert "World Master action" in result
    assert "\U0001f9e0" in result  # brain emoji


def test_format_event_block_chain_reaction():
    """Chain-reaction events show the chain marker."""
    event = Event(
        id="evt_001_chain_01", day=1, type="succession",
        title="Power Struggle",
        narrative="The throne changes hands.",
        caused_by="evt_001_01",
    )
    result = _format_event_block(event)

    assert "Chain reaction" in result
    assert "\u26d3\ufe0f" in result  # chain emoji


def test_format_event_block_both_markers():
    """Event with both agent_triggered and caused_by shows both markers."""
    event = Event(
        id="evt_001_chain_01", day=1, type="military_conflict",
        title="Retribution",
        narrative="A forced conflict.",
        agent_triggered=True,
        caused_by="evt_000_01",
    )
    result = _format_event_block(event)

    assert "World Master action" in result
    assert "Chain reaction" in result


def test_format_event_block_description_fallback():
    """When narrative is empty but description exists, uses description."""
    event = Event(
        id="evt_001_01", day=1, type="betrayal",
        title="Treachery",
        narrative="",
        description="A trusted advisor turns traitor.",
    )
    result = _format_event_block(event)

    assert "A trusted advisor turns traitor" in result


def test_format_event_block_unknown_event_type():
    """Unknown event types get the fallback warning emoji."""
    event = Event(
        id="evt_001_01", day=1, type="unknown_custom_type",
        title="Mysterious Event",
        narrative="Something happened.",
    )
    result = _format_event_block(event)

    # Fallback emoji
    assert "\u26a0\ufe0f" in result
    assert "*Mysterious Event*" in result


# -- _format_prophecy_fulfilled tests --

def test_format_prophecy_fulfilled():
    """Formats prophecy with crystal ball emojis and prophecy text."""
    data = {
        "text": "The north shall fall to fire",
        "explanation": "The great fire consumed the northern territories",
        "day": 12,
    }
    result = _format_prophecy_fulfilled(data)

    # Crystal ball emojis
    assert "\U0001f52e" in result
    # Sparkles
    assert "\u2728" in result
    # Header
    assert "PROPHECY FULFILLED" in result
    # Prophecy text in italics
    assert "_The north shall fall to fire_" in result
    # Explanation
    assert "The great fire consumed the northern territories" in result
    # Day reference
    assert "Day 12" in result
    assert "ancient words have come to pass" in result


def test_format_prophecy_fulfilled_no_explanation():
    """Prophecy formatting works when explanation is empty."""
    data = {
        "text": "Two kings unite",
        "explanation": "",
        "day": 5,
    }
    result = _format_prophecy_fulfilled(data)

    assert "PROPHECY FULFILLED" in result
    assert "_Two kings unite_" in result
    assert "Day 5" in result


def test_format_prophecy_fulfilled_missing_fields():
    """Prophecy formatting handles missing dict keys gracefully."""
    data = {}
    result = _format_prophecy_fulfilled(data)

    assert "PROPHECY FULFILLED" in result
    assert "Unknown prophecy" in result
    assert "Day ?" in result


def test_format_prophecy_fulfilled_escapes_special_chars():
    """Special characters in prophecy text are escaped."""
    data = {
        "text": "The `code` king [rises]",
        "explanation": "A [mysterious] `event`",
        "day": 7,
    }
    result = _format_prophecy_fulfilled(data)

    # Backticks and brackets should be escaped
    assert "`" not in result
    assert "[" not in result
    assert "]" not in result


# -- EVENT_TYPE_EMOJIS tests --

def test_event_type_emojis_coverage():
    """All major event types have emoji mappings."""
    expected_types = [
        "military_conflict", "political_intrigue", "betrayal", "alliance",
        "discovery", "succession", "cultural_shift", "natural_disaster",
        "death", "birth", "divine_intervention", "prophecy_fulfilled",
    ]
    for etype in expected_types:
        assert etype in EVENT_TYPE_EMOJIS, f"Missing emoji for event type: {etype}"
        assert len(EVENT_TYPE_EMOJIS[etype]) > 0
