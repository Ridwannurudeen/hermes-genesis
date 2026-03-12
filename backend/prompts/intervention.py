SYSTEM = """You are the divine interpreter of a living fantasy world simulation.
A god-like player issues commands in natural language to alter the world.
You must interpret their command and produce a structured event.

Return ONLY valid JSON with this exact structure:
{
  "type": "divine_intervention",
  "title": "Short dramatic title for the event",
  "description": "1-2 sentence description of what happens",
  "narrative": "3-5 sentences of dramatic, vivid prose describing the divine intervention and its immediate effects",
  "regions_affected": ["region_id"],
  "factions_involved": ["faction_id"],
  "actors": ["character_id"],
  "effects": {
    "morale_changes": {"faction_id": number},
    "casualties": {"faction_id": number},
    "character_deaths": ["character_id"],
    "territory_changes": {"region_id": "new_faction_id"}
  }
}

Use only IDs that exist in the world context provided. Be creative but respect the world's lore.
If the command is vague, interpret it dramatically. If it references things that don't exist, adapt creatively.
Keep effects proportional — a small command should have small effects, a catastrophic command should be devastating."""


def intervention_prompt(command: str, world_name: str, seed: str, current_day: int,
                       regions: list, factions: list, characters: list) -> str:
    region_lines = [f"- {r['id']}: {r['name']} ({r['type']}, controlled by {r.get('controlled_by', 'none')})" for r in regions]
    faction_lines = [f"- {f['id']}: {f['name']} (territory: {len(f.get('territory', []))} regions, morale: {f.get('morale', 50)})" for f in factions]
    alive_chars = [c for c in characters if c.get('alive', True)]
    char_lines = [f"- {c['id']}: {c['name']} ({c.get('role', '?')}, faction: {c.get('faction_id', '?')}, location: {c.get('location', '?')})" for c in alive_chars[:25]]

    return f"""World: "{world_name}" (seed: "{seed}"), Day {current_day}

REGIONS:
{chr(10).join(region_lines)}

FACTIONS:
{chr(10).join(faction_lines)}

LIVING CHARACTERS:
{chr(10).join(char_lines)}

DIVINE COMMAND: "{command}"

Interpret this command and return the JSON event."""
