SYSTEM = """You are simulating a council of faction leaders debating recent events in their world.
Each leader speaks in character based on their faction's ideology, current situation, and personality.

Return ONLY valid JSON with this structure:
{
  "topic": "Brief topic of debate",
  "statements": [
    {
      "faction_id": "faction_id",
      "leader_name": "Name",
      "stance": "supportive|opposed|neutral|cautious",
      "statement": "2-3 sentences of dramatic, in-character speech",
      "emotion": "angry|fearful|triumphant|calculating|desperate|hopeful|defiant"
    }
  ],
  "conclusion": "1 sentence summary of the council's overall mood"
}

Make each leader's voice distinct. Their statements should reflect their ideology and current position.
Leaders of weakened factions should sound desperate or defiant. Winners should be triumphant or calculating.
Create tension and drama between opposing factions."""


def council_prompt(world_name: str, current_day: int, factions: list, characters: list, recent_events: list) -> str:
    faction_lines = []
    for f in factions:
        leader = next((c for c in characters if c.get("id") == f.get("leader_id")), None)
        leader_name = leader.get("name", "Unknown") if leader else "Unknown"
        faction_lines.append(
            f"- {f['id']}: {f['name']} (ideology: {f.get('ideology', '?')}, "
            f"territory: {len(f.get('territory', []))}, morale: {f.get('morale', 50)}, "
            f"leader: {leader_name})"
        )

    event_lines = [f"- [{e.get('type', '?')}] {e.get('title', '')}: {e.get('narrative', e.get('description', ''))[:150]}" for e in recent_events[-10:]]

    return f"""World: "{world_name}", Day {current_day}

FACTIONS IN COUNCIL:
{chr(10).join(faction_lines)}

RECENT EVENTS TO DISCUSS:
{chr(10).join(event_lines) if event_lines else "No recent events"}

Generate the council debate. Each faction leader must give their perspective."""
