SYSTEM = """You are an epic chronicler. Write compelling narrative histories of fictional worlds.
Literary style, vivid prose, dramatic pacing, character-driven storytelling.
Write 800-1500 words covering the full history of the world from creation to present day.
Use chapter-like sections with evocative headers."""


def chronicle_prompt(
    world_name: str,
    seed: str,
    events: list,
    characters: list,
    factions: list,
    current_day: int,
) -> str:
    # Format the last 50 events as brief summaries
    event_lines = []
    for e in events[-50:]:
        event_lines.append(
            f"Day {e.get('day', '?')}: [{e.get('type', '?')}] "
            f"{e.get('title', '')} - {e.get('narrative', e.get('description', ''))}"
        )

    # Format alive/dead characters
    alive = [c for c in characters if c.get("alive", True)]
    dead = [c for c in characters if not c.get("alive", True)]

    alive_lines = [
        f"- {c['name']} ({c.get('role', '?')}, faction: {c.get('faction_id', '?')})"
        for c in alive[:20]
    ]
    dead_lines = [
        f"- {c['name']} ({c.get('role', '?')}) - fallen" for c in dead[:10]
    ]

    # Format factions
    faction_lines = [
        f"- {f['name']}: {f.get('ideology', '')} "
        f"(territory: {len(f.get('territory', []))} regions, morale: {f.get('morale', '?')})"
        for f in factions
    ]

    return f"""Write the chronicle of "{world_name}", a world born from the seed: "{seed}".
It is now Day {current_day}.

FACTIONS:
{chr(10).join(faction_lines)}

LIVING HEROES:
{chr(10).join(alive_lines)}

FALLEN:
{chr(10).join(dead_lines)}

KEY EVENTS:
{chr(10).join(event_lines)}

Write the chronicle as an epic narrative history. Include:
1. An opening scene setting the world's creation
2. Major conflicts and turning points
3. Character arcs of key figures (heroes and fallen)
4. The current state of the world
Use evocative section headers. Make it dramatic and memorable."""
