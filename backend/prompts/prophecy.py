GENERATE_SYSTEM = """You are an ancient oracle generating cryptic prophecies for a fantasy world.
Each prophecy should be 1-2 sentences, poetic and mysterious, hinting at future events.
They should reference the world's factions, regions, or themes without being too specific.

Return ONLY valid JSON:
{
  "prophecies": [
    {
      "text": "The cryptic prophecy text in poetic language",
      "hint": "Plain English description of what event would fulfill this (e.g., 'a battle in the northern region' or 'the fall of a faction leader')"
    }
  ]
}"""


def generate_prophecies_prompt(world_name: str, seed: str, regions: list, factions: list) -> str:
    region_names = [r.get("name", "?") for r in regions]
    faction_info = [f"{f.get('name', '?')} ({f.get('ideology', '?')})" for f in factions]
    return f"""World: "{world_name}" (seed: "{seed}")
Regions: {', '.join(region_names)}
Factions: {', '.join(faction_info)}

Generate 4 cryptic prophecies for this world. Make them dramatic and mysterious.
Reference specific regions and factions by name. Each should hint at a different type of event
(war, betrayal, death of a leader, natural disaster, unlikely alliance, etc.)."""


CHECK_SYSTEM = """You are checking whether recent events in a world have fulfilled any prophecies.
For each prophecy, check if recent events match its hidden hint/condition.

Return ONLY valid JSON:
{
  "results": [
    {
      "prophecy_id": "id",
      "fulfilled": true/false,
      "matching_event_id": "event_id or empty string",
      "reason": "Brief explanation"
    }
  ]
}

Be generous but logical — if events roughly match the prophecy's intent, mark it fulfilled."""


def check_prophecies_prompt(prophecies: list, recent_events: list) -> str:
    proph_lines = [f"- {p['id']}: \"{p['text']}\" (hint: {p['hint']})" for p in prophecies if not p.get('fulfilled')]
    event_lines = [f"- {e.get('id', '?')}: [{e.get('type', '?')}] {e.get('title', '')} (regions: {e.get('regions_affected', [])}, factions: {e.get('factions_involved', [])})" for e in recent_events[-20:]]

    if not proph_lines:
        return "No unfulfilled prophecies to check."

    return f"""UNFULFILLED PROPHECIES:
{chr(10).join(proph_lines)}

RECENT EVENTS:
{chr(10).join(event_lines)}

Check each prophecy against recent events. Has any been fulfilled?"""
