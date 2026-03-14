SYSTEM = """You are a world-building engine. You generate characters with deep personalities.
Output ONLY valid JSON — no commentary, no markdown outside the JSON block."""

def user_prompt(seed: str, factions: list[dict], regions: list[dict], num_chars: int = 15) -> str:
    faction_info = [f"{f['id']}: {f['name']} — {f['ideology']} (territory: {f.get('territory', [])})" for f in factions]
    faction_list = "\n".join(faction_info)
    region_info = [f"{r['id']}: {r['name']}" for r in regions]
    region_list = ", ".join(region_info)
    return f"""Generate characters for this world: "{seed}"

Factions:
{faction_list}

Regions: {region_list}

Create exactly {num_chars} characters. Each faction must have a leader and 2-4 other members. Output JSON array:
```json
[
  {{
    "id": "char_01",
    "name": "Character Name",
    "faction_id": "faction_01",
    "role": "leader|general|spy|scholar|merchant|rebel|healer|explorer",
    "age": 34,
    "location": "region_01",
    "backstory": "2-3 sentence compelling backstory",
    "goals": ["goal_1", "goal_2"],
    "relationships": [
      {{ "target_id": "char_05", "type": "rival|ally|mentor|protege|lover|enemy|sibling", "intensity": 0.8 }}
    ],
    "genome": {{
      "courage": 0.82,
      "cunning": 0.91,
      "loyalty": 0.45,
      "ambition": 0.88,
      "empathy": 0.30,
      "resilience": 0.76
    }}
  }}
]
```

Rules:
- IDs char_01 through char_{num_chars:02d}
- Exactly one leader per faction
- Genome values 0.0-1.0 reflecting personality (high ambition + low loyalty = betrayal risk)
- Each character has 1-3 relationships with other characters
- Goals must be specific and actionable
- Characters located in regions their faction controls
- Diverse ages (18-70), diverse roles

Genome Archetypes (use as inspiration, not copy):
- Warrior: courage=0.9, resilience=0.8, loyalty=0.7, cunning=0.3, empathy=0.2, ambition=0.5
- Spymaster: cunning=0.95, ambition=0.8, loyalty=0.3, courage=0.4, empathy=0.2, resilience=0.5
- Healer: empathy=0.9, resilience=0.7, loyalty=0.8, courage=0.4, cunning=0.3, ambition=0.2
- Rebel: ambition=0.9, courage=0.7, loyalty=0.2, cunning=0.6, empathy=0.4, resilience=0.6
Mix and deviate freely — these are starting points, not templates."""
