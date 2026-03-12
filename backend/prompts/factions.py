SYSTEM = """You are a world-building engine. You generate factions with rich political dynamics.
Output ONLY valid JSON — no commentary, no markdown outside the JSON block."""

def user_prompt(seed: str, regions: list[dict], num_factions: int = 4) -> str:
    region_names = [f"{r['id']}: {r['name']} ({r['type']}, resources: {r.get('resources', [])})" for r in regions]
    region_list = "\n".join(region_names)
    return f"""Generate factions for this world: "{seed}"

Available regions:
{region_list}

Create exactly {num_factions} factions. Output JSON array:
```json
[
  {{
    "id": "faction_01",
    "name": "Faction Name",
    "ideology": "2-3 word ideology",
    "color": "#hex color",
    "territory": ["region_01", "region_03"],
    "resources": {{ "military": 60, "economy": 40, "technology": 30, "influence": 50 }},
    "alliances": [],
    "enemies": ["faction_02"],
    "population": 2400,
    "morale": 72,
    "traits": ["trait1", "trait2", "trait3"],
    "description": "2-3 sentence description of culture and goals"
  }}
]
```

Rules:
- Every region must be controlled by exactly one faction
- At least one pair of factions must be enemies
- At least one alliance between factions
- Resource values 0-100
- Colors must be visually distinct (use bold colors: #e74c3c red, #3498db blue, #2ecc71 green, #f39c12 gold, #9b59b6 purple, #e67e22 orange)
- Each faction has 2-4 personality traits"""
