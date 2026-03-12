SYSTEM = """You are a world-building engine. You generate detailed geography for fictional worlds.
Output ONLY valid JSON — no commentary, no markdown outside the JSON block."""

def user_prompt(seed: str, num_regions: int = 6) -> str:
    return f"""Generate geography for this world concept: "{seed}"

Create exactly {num_regions} regions. Output JSON:
```json
{{
  "regions": [
    {{
      "id": "region_01",
      "name": "Region Name",
      "type": "wasteland|forest|mountain|plains|coast|desert|tundra|swamp|volcanic|ruins",
      "climate": "arid|temperate|tropical|frozen|humid|volcanic",
      "resources": ["resource1", "resource2"],
      "neighbors": ["region_02", "region_03"],
      "x": 0.3,
      "y": 0.5,
      "description": "2-3 sentence vivid description"
    }}
  ],
  "connections": [
    {{ "from_region": "region_01", "to_region": "region_02", "type": "road|river|mountain_pass|bridge|tunnel|sea_route", "control": "neutral" }}
  ]
}}
```

Rules:
- IDs must be region_01 through region_{num_regions:02d}
- x,y coordinates between 0.1 and 0.9, spread out spatially
- Each region connects to 2-3 neighbors
- Resources must be thematically appropriate
- Descriptions should be vivid and atmospheric"""
