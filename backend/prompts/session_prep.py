SYSTEM = """You are a veteran Game Master preparing a focused 3-hour TTRPG session.
Write a structured, ready-to-run session plan based on the current world state.
Be specific — use actual character names, locations, and recent events.
Write read-aloud text in quotes. Write GM notes in [brackets].
Format with clear markdown headers and numbered steps."""


def session_prep_prompt(world_name: str, seed: str, current_day: int,
                        regions: list, factions: list, characters: list,
                        events: list) -> str:
    # Build region context
    region_text = ""
    for r in regions:
        region_text += f"\n- {r.get('name', '?')} ({r.get('type', '?')})"
        region_text += f" — {r.get('description', '')[:120]}"
        region_text += f", controlled by: {r.get('controlled_by', 'contested')}"

    # Build faction context with tensions
    faction_text = ""
    for f in factions:
        faction_text += f"\n### {f.get('name', '?')}"
        faction_text += f"\nLeader: {f.get('leader', '?')}, Morale: {f.get('morale', '?')}/100"
        faction_text += f"\nGoals: {f.get('ideology', '?')}"
        faction_text += f"\nAllies: {', '.join(f.get('alliances', [])) or 'none'}"
        faction_text += f"\nEnemies: {', '.join(f.get('enemies', [])) or 'none'}"
        faction_text += f"\nTraits: {', '.join(f.get('traits', []))}\n"

    # Build alive characters with roles and traits
    alive = [c for c in characters if c.get("alive", True)]
    char_text = ""
    for c in alive[:15]:
        genome = c.get("genome", {})
        char_text += f"\n- {c.get('name', '?')} ({c.get('role', '?')})"
        char_text += f" — Faction: {c.get('faction_id', '?')}"
        char_text += f", Location: {c.get('location', '?')}"
        char_text += f", Goals: {', '.join(c.get('goals', []))}"
        char_text += f", Traits: courage={genome.get('courage', 0.5):.1f}"
        char_text += f" cunning={genome.get('cunning', 0.5):.1f}"
        char_text += f" ambition={genome.get('ambition', 0.5):.1f}"
        char_text += f" loyalty={genome.get('loyalty', 0.5):.1f}"

    # Build recent events (last 10)
    recent_events = events[-10:]
    event_text = ""
    for e in recent_events:
        event_text += f"\n- Day {e.get('day', '?')}: [{e.get('type', '?')}] {e.get('title', '')}"
        narrative = e.get('narrative', e.get('description', ''))
        if narrative:
            event_text += f" — {narrative[:200]}"

    return f"""Generate a session plan for tonight's 3-hour TTRPG session in this world.

WORLD: "{world_name}"
PREMISE: "{seed}"
CURRENT DAY: {current_day}

REGIONS:{region_text}

FACTIONS:{faction_text}

ALIVE CHARACTERS:{char_text}

RECENT EVENTS (last 10):{event_text}

Generate a session plan with these sections:

## Session Overview
One paragraph: what this session is about, the central tension.

## Opening Scene (Read-Aloud)
2-3 paragraphs of atmospheric read-aloud text the GM reads to players. Set the scene using a specific location and recent event.

## Encounter 1: [Name] (Social/Exploration)
- Setup: What's happening, who's involved
- Key NPC: Name, personality in 1 line, what they want
- NPC Dialogue: 3 ready-to-use lines
- Possible Outcomes: 2-3 bullet points

## Encounter 2: [Name] (Combat/Conflict)
- Setup: The conflict escalates
- Enemies/Opposition: Who, how many, tactics
- Environment: Terrain features, hazards
- Difficulty: Easy/Medium/Hard
- Possible Outcomes: 2-3 bullet points

## Encounter 3: [Name] (Mystery/Revelation)
- Setup: A twist or discovery
- Clues to Plant: 3 specific clues
- Key Revelation: What the players learn
- Possible Outcomes: 2-3 bullet points

## Climax
How the three encounters converge. The big moment. Include read-aloud text.

## Cliffhanger Ending
The hook for next session. End on tension.

## Quick Reference
- Key NPCs: name, role, 1-line personality (3-5 NPCs)
- Key Locations: name, 1-line description (2-3 locations)
- Loot/Rewards: 2-3 items or story rewards

Use actual names, locations, and events from the world data above. Be specific and practical — a GM should be able to run this session directly from this document."""
