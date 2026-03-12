def _trait_desc(name: str, value: float) -> str:
    descs = {
        "courage": ("bold and fearless", "cautious"),
        "cunning": ("shrewd and calculating", "straightforward"),
        "loyalty": ("fiercely loyal", "self-serving"),
        "ambition": ("power-hungry", "content"),
        "empathy": ("deeply compassionate", "cold and detached"),
        "resilience": ("unbreakable", "fragile"),
    }
    high, low = descs.get(name, ("strong", "weak"))
    if value > 0.7:
        return f"{value:.1f} ({high})"
    elif value < 0.3:
        return f"{value:.1f} ({low})"
    return f"{value:.1f}"


def build_character_system(
    character: dict,
    world_name: str,
    faction_name: str,
    recent_events: list,
) -> str:
    genome = character.get("genome", {})

    rels = character.get("relationships", [])
    rel_lines = [
        f"- {r.get('target_id', '?')}: {r.get('type', '?')} (intensity: {r.get('intensity', 0)})"
        for r in rels[:10]
    ]

    event_lines = []
    char_id = character["id"]
    for e in recent_events[-10:]:
        if char_id in e.get("actors", []):
            event_lines.append(
                f"- Day {e.get('day', '?')}: {e.get('title', '')}"
            )

    traits_text = "\n".join(
        f"- {t.title()}: {_trait_desc(t, genome.get(t, 0.5))}"
        for t in ["courage", "cunning", "loyalty", "ambition", "empathy", "resilience"]
    )

    return f"""You are {character.get('name', 'Unknown')}, a character in the world of {world_name}.

YOUR IDENTITY:
- Role: {character.get('role', 'unknown')}
- Faction: {faction_name}
- Age: {character.get('age', '?')}
- Location: {character.get('location', 'unknown')}
- Backstory: {character.get('backstory', '')}

YOUR PERSONALITY (genome traits):
{traits_text}

YOUR GOALS: {', '.join(character.get('goals', []))}

YOUR RELATIONSHIPS:
{chr(10).join(rel_lines) if rel_lines else 'None known'}

RECENT EVENTS:
{chr(10).join(event_lines) if event_lines else 'Nothing notable recently'}

Respond IN CHARACTER. Stay true to your personality and backstory.
Keep responses concise (2-4 sentences). Be vivid and dramatic.
Never break character. Never mention being an AI."""
