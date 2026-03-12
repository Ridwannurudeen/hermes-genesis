# HERMES GENESIS Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an autonomous living world engine that generates procedural universes with evolving characters, deploys them as interactive web explorers, and simulates events autonomously with Telegram narrative delivery.

**Architecture:** FastAPI backend handles world generation (via Nous/Hermes LLM), simulation, and genome evolution. React frontend renders interactive SVG map, faction dashboards, character profiles with genome radar charts, event timeline, and evolution view. Hermes-agent skills orchestrate generation via subagents and schedule simulation via cron. World data persisted as JSON files.

**Tech Stack:** Python 3.11, FastAPI, uvicorn, httpx (Nous API), React 18, TypeScript, Vite, Tailwind CSS, D3.js (map), Recharts (genome radar), Framer Motion (animations), Docker, nginx

---

## Task 1: Project Scaffolding

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/config.py`
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Initialize git repo**

```bash
cd C:/Users/GUDMAN/Desktop/hermes-genesis
git init
```

**Step 2: Create backend scaffolding**

`backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
httpx==0.27.0
pydantic==2.9.0
websockets==13.0
python-dotenv==1.0.1
```

`backend/config.py`:
```python
import os
from dotenv import load_dotenv

load_dotenv()

NOUS_API_KEY = os.getenv("NOUS_API_KEY", "")
NOUS_BASE_URL = os.getenv("NOUS_BASE_URL", "https://inference-api.nousresearch.com/v1")
NOUS_MODEL = os.getenv("NOUS_MODEL", "Hermes-4-70B")
DATA_DIR = os.getenv("DATA_DIR", "data/worlds")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8003"))
```

`backend/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import HOST, PORT

app = FastAPI(title="Hermes Genesis", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
```

**Step 3: Create frontend scaffolding**

`frontend/package.json`:
```json
{
  "name": "hermes-genesis",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "d3": "^7.9.0",
    "recharts": "^2.12.0",
    "framer-motion": "^11.3.0",
    "lucide-react": "^0.441.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@types/d3": "^7.4.3",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "~5.5.3",
    "vite": "^5.4.0"
  }
}
```

`frontend/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8003', '/ws': { target: 'ws://localhost:8003', ws: true } } },
  build: { outDir: 'dist' }
})
```

`frontend/tailwind.config.js`:
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        genesis: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d', 950: '#052e16' }
      }
    }
  },
  plugins: []
}
```

`frontend/postcss.config.js`:
```javascript
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

`frontend/index.html`:
```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hermes Genesis</title>
  <meta name="description" content="Autonomous Living World Engine — Describe a world. Watch it live." />
</head>
<body class="bg-gray-950 text-gray-100">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

`frontend/src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
```

`frontend/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

`frontend/src/App.tsx`:
```tsx
export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <h1 className="text-4xl font-bold text-genesis-400">Hermes Genesis</h1>
    </div>
  )
}
```

`.gitignore`:
```
__pycache__/
*.pyc
.env
data/
node_modules/
dist/
.vite/
*.log
```

**Step 4: Install dependencies and verify**

```bash
cd C:/Users/GUDMAN/Desktop/hermes-genesis/backend && pip install -r requirements.txt
cd C:/Users/GUDMAN/Desktop/hermes-genesis/frontend && npm install
```

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: project scaffolding — FastAPI backend + React frontend"
```

---

## Task 2: World Data Model

**Files:**
- Create: `backend/models/__init__.py`
- Create: `backend/models/world.py`
- Create: `backend/models/geography.py`
- Create: `backend/models/faction.py`
- Create: `backend/models/character.py`
- Create: `backend/models/event.py`
- Create: `backend/models/genome.py`
- Create: `backend/store.py`
- Create: `backend/tests/test_models.py`
- Create: `backend/tests/__init__.py`

**Step 1: Write models**

`backend/models/__init__.py`:
```python
from .world import World
from .geography import Region, Connection, Geography
from .faction import Faction
from .character import Character, Genome, Lineage
from .event import Event, EventOutcome
```

`backend/models/genome.py`:
```python
import random
from pydantic import BaseModel, Field

TRAITS = ["courage", "cunning", "loyalty", "ambition", "empathy", "resilience"]

class Genome(BaseModel):
    courage: float = Field(default_factory=lambda: random.uniform(0.2, 0.9))
    cunning: float = Field(default_factory=lambda: random.uniform(0.2, 0.9))
    loyalty: float = Field(default_factory=lambda: random.uniform(0.2, 0.9))
    ambition: float = Field(default_factory=lambda: random.uniform(0.2, 0.9))
    empathy: float = Field(default_factory=lambda: random.uniform(0.2, 0.9))
    resilience: float = Field(default_factory=lambda: random.uniform(0.2, 0.9))

    def to_dict(self) -> dict:
        return {t: getattr(self, t) for t in TRAITS}

    @staticmethod
    def crossover(parent_a: "Genome", parent_b: "Genome", mutation_rate: float = 0.1) -> "Genome":
        child = {}
        for trait in TRAITS:
            val = getattr(parent_a, trait) if random.random() < 0.5 else getattr(parent_b, trait)
            if random.random() < mutation_rate:
                val = max(0.0, min(1.0, val + random.gauss(0, 0.1)))
            child[trait] = round(val, 3)
        return Genome(**child)

    def fitness(self, survival: float, influence: float, goals: float, relationships: float) -> float:
        return round(0.3 * survival + 0.25 * influence + 0.25 * goals + 0.2 * relationships, 3)
```

`backend/models/geography.py`:
```python
from typing import Optional
from pydantic import BaseModel

class PointOfInterest(BaseModel):
    name: str
    type: str
    significance: str

class Region(BaseModel):
    id: str
    name: str
    type: str
    climate: str
    resources: list[str] = []
    controlled_by: Optional[str] = None
    neighbors: list[str] = []
    points_of_interest: list[PointOfInterest] = []
    x: float = 0.5
    y: float = 0.5
    description: str = ""

class Connection(BaseModel):
    from_region: str
    to_region: str
    type: str = "road"
    control: str = "neutral"

class Geography(BaseModel):
    regions: list[Region] = []
    connections: list[Connection] = []
```

`backend/models/faction.py`:
```python
from pydantic import BaseModel

class Faction(BaseModel):
    id: str
    name: str
    ideology: str
    color: str = "#666666"
    leader_id: str = ""
    territory: list[str] = []
    resources: dict[str, int] = {}
    alliances: list[str] = []
    enemies: list[str] = []
    population: int = 1000
    morale: int = 50
    traits: list[str] = []
    description: str = ""
```

`backend/models/character.py`:
```python
from typing import Optional
from pydantic import BaseModel, Field
from .genome import Genome

class Lineage(BaseModel):
    parent_ids: list[str] = []
    generation: int = 0
    mutations: list[str] = []

class Relationship(BaseModel):
    target_id: str
    type: str
    intensity: float = 0.5

class Character(BaseModel):
    id: str
    name: str
    faction_id: str = ""
    role: str = "citizen"
    age: int = 30
    alive: bool = True
    location: str = ""
    backstory: str = ""
    goals: list[str] = []
    relationships: list[Relationship] = []
    genome: Genome = Field(default_factory=Genome)
    lineage: Lineage = Field(default_factory=Lineage)
    fitness: float = 0.5
```

`backend/models/event.py`:
```python
from typing import Optional
from pydantic import BaseModel

class CharacterEffect(BaseModel):
    char_id: str
    effect: str
    value: float | bool | str = 0

class EventOutcome(BaseModel):
    territory_changes: dict[str, str] = {}
    casualties: dict[str, int] = {}
    morale_changes: dict[str, int] = {}
    resource_changes: dict[str, dict[str, int]] = {}
    character_effects: list[CharacterEffect] = []

class Event(BaseModel):
    id: str
    day: int
    type: str
    title: str
    description: str = ""
    actors: list[str] = []
    factions_involved: list[str] = []
    regions_affected: list[str] = []
    outcome: EventOutcome = EventOutcome()
    narrative: str = ""
```

`backend/models/world.py`:
```python
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime
from .geography import Geography
from .faction import Faction
from .character import Character
from .event import Event

class WorldRules(BaseModel):
    theme: str = ""
    magic_level: str = "none"
    tech_level: str = "medieval"
    conflict_driver: str = ""
    special_rules: list[str] = []

class World(BaseModel):
    id: str
    name: str
    seed: str
    theme: str = ""
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    current_day: int = 0
    geography: Geography = Field(default_factory=Geography)
    factions: list[Faction] = []
    characters: list[Character] = []
    events: list[Event] = []
    rules: WorldRules = Field(default_factory=WorldRules)
    status: str = "generating"
```

`backend/store.py`:
```python
import json
import os
from pathlib import Path
from models.world import World
from config import DATA_DIR

def _world_path(world_id: str) -> Path:
    return Path(DATA_DIR) / f"{world_id}.json"

def save_world(world: World) -> None:
    path = _world_path(world.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(world.model_dump(), indent=2))

def load_world(world_id: str) -> World | None:
    path = _world_path(world_id)
    if not path.exists():
        return None
    return World.model_validate(json.loads(path.read_text()))

def list_worlds() -> list[dict]:
    d = Path(DATA_DIR)
    if not d.exists():
        return []
    worlds = []
    for f in sorted(d.glob("world_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            w = json.loads(f.read_text())
            worlds.append({"id": w["id"], "name": w["name"], "seed": w["seed"], "theme": w.get("theme", ""), "current_day": w.get("current_day", 0), "status": w.get("status", "ready"), "created_at": w.get("created_at", "")})
        except Exception:
            continue
    return worlds

def delete_world(world_id: str) -> bool:
    path = _world_path(world_id)
    if path.exists():
        path.unlink()
        return True
    return False
```

**Step 2: Write tests**

`backend/tests/__init__.py`: (empty)

`backend/tests/test_models.py`:
```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from models.genome import Genome, TRAITS

def test_genome_defaults():
    g = Genome()
    for t in TRAITS:
        assert 0.0 <= getattr(g, t) <= 1.0

def test_genome_crossover():
    a = Genome(courage=1.0, cunning=0.0, loyalty=1.0, ambition=0.0, empathy=1.0, resilience=0.0)
    b = Genome(courage=0.0, cunning=1.0, loyalty=0.0, ambition=1.0, empathy=0.0, resilience=1.0)
    child = Genome.crossover(a, b, mutation_rate=0.0)
    for t in TRAITS:
        assert getattr(child, t) in (0.0, 1.0)

def test_genome_crossover_mutation():
    a = Genome(courage=0.5, cunning=0.5, loyalty=0.5, ambition=0.5, empathy=0.5, resilience=0.5)
    b = Genome(courage=0.5, cunning=0.5, loyalty=0.5, ambition=0.5, empathy=0.5, resilience=0.5)
    child = Genome.crossover(a, b, mutation_rate=1.0)
    # With 100% mutation, at least some trait should differ from 0.5
    diffs = [abs(getattr(child, t) - 0.5) for t in TRAITS]
    assert any(d > 0.001 for d in diffs)

def test_genome_fitness():
    g = Genome()
    f = g.fitness(survival=1.0, influence=0.8, goals=0.6, relationships=0.4)
    expected = round(0.3 * 1.0 + 0.25 * 0.8 + 0.25 * 0.6 + 0.2 * 0.4, 3)
    assert f == expected

def test_genome_clamp():
    a = Genome(courage=0.99, cunning=0.99, loyalty=0.99, ambition=0.99, empathy=0.99, resilience=0.99)
    b = Genome(courage=0.99, cunning=0.99, loyalty=0.99, ambition=0.99, empathy=0.99, resilience=0.99)
    for _ in range(100):
        child = Genome.crossover(a, b, mutation_rate=1.0)
        for t in TRAITS:
            assert 0.0 <= getattr(child, t) <= 1.0
```

**Step 3: Run tests**

```bash
cd C:/Users/GUDMAN/Desktop/hermes-genesis/backend && python -m pytest tests/test_models.py -v
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: world data model with genome crossover/fitness"
```

---

## Task 3: LLM Generation Engine

**Files:**
- Create: `backend/llm.py`
- Create: `backend/generator.py`
- Create: `backend/prompts/__init__.py`
- Create: `backend/prompts/geography.py`
- Create: `backend/prompts/factions.py`
- Create: `backend/prompts/characters.py`
- Create: `backend/prompts/assembler.py`

**Step 1: Create LLM client**

`backend/llm.py`:
```python
import httpx
import json
from config import NOUS_API_KEY, NOUS_BASE_URL, NOUS_MODEL

async def chat_completion(system: str, user: str, temperature: float = 0.9, max_tokens: int = 4000) -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{NOUS_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {NOUS_API_KEY}", "Content-Type": "application/json"},
            json={
                "model": NOUS_MODEL,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]

def extract_json(text: str) -> dict | list:
    """Extract JSON from LLM response, handling markdown code blocks."""
    text = text.strip()
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()
    return json.loads(text)
```

**Step 2: Create generation prompts**

`backend/prompts/__init__.py`: (empty)

`backend/prompts/geography.py`:
```python
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
```

`backend/prompts/factions.py`:
```python
SYSTEM = """You are a world-building engine. You generate factions with rich political dynamics.
Output ONLY valid JSON — no commentary, no markdown outside the JSON block."""

def user_prompt(seed: str, regions: list[dict], num_factions: int = 4) -> str:
    region_names = [f"{r['id']}: {r['name']} ({r['type']}, resources: {r['resources']})" for r in regions]
    region_list = "\n".join(region_names)
    return f"""Generate factions for this world: "{seed}"

Available regions:
{region_list}

Create exactly {num_factions} factions. Output JSON:
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
- Colors must be visually distinct (use bold colors: red, blue, green, gold, purple, orange)
- Each faction has 2-4 personality traits"""
```

`backend/prompts/characters.py`:
```python
SYSTEM = """You are a world-building engine. You generate characters with deep personalities.
Output ONLY valid JSON — no commentary, no markdown outside the JSON block."""

def user_prompt(seed: str, factions: list[dict], regions: list[dict], num_chars: int = 15) -> str:
    faction_info = [f"{f['id']}: {f['name']} — {f['ideology']} (territory: {f['territory']})" for f in factions]
    faction_list = "\n".join(faction_info)
    region_info = [f"{r['id']}: {r['name']}" for r in regions]
    region_list = ", ".join(region_info)
    return f"""Generate characters for this world: "{seed}"

Factions:
{faction_list}

Regions: {region_list}

Create exactly {num_chars} characters. Each faction must have a leader and 2-4 other members. Output JSON:
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
- Exactly one leader per faction (role: "leader", set as faction leader)
- Genome values 0.0-1.0 — make them reflect the character's personality
- High-ambition + low-loyalty characters are betrayal risks
- Each character has 1-3 relationships with other characters
- Goals must be specific and actionable (not vague)
- Characters must be located in regions their faction controls
- Diverse ages (18-70), diverse roles"""
```

`backend/prompts/assembler.py`:
```python
from models.world import World, WorldRules
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character, Genome, Lineage, Relationship
import uuid

def assemble_world(seed: str, geo_data: dict, faction_data: list, char_data: list) -> World:
    world_id = f"world_{uuid.uuid4().hex[:12]}"

    # Parse geography
    regions = [Region(**r) for r in geo_data.get("regions", [])]
    connections = [Connection(**c) for c in geo_data.get("connections", [])]
    geography = Geography(regions=regions, connections=connections)

    # Parse factions
    factions = []
    for f in faction_data:
        factions.append(Faction(**f))

    # Parse characters
    characters = []
    for c in char_data:
        genome_data = c.pop("genome", {})
        rels_data = c.pop("relationships", [])
        relationships = [Relationship(**r) for r in rels_data]
        char = Character(
            **c,
            genome=Genome(**genome_data),
            relationships=relationships,
            lineage=Lineage(generation=0)
        )
        characters.append(char)

    # Link faction leaders
    for char in characters:
        if char.role == "leader":
            for f in factions:
                if f.id == char.faction_id:
                    f.leader_id = char.id

    # Assign faction territory control to regions
    for f in factions:
        for region in regions:
            if region.id in f.territory:
                region.controlled_by = f.id

    # Infer theme
    theme = seed.split(",")[0].strip() if "," in seed else seed[:50]

    return World(
        id=world_id,
        name="",  # Will be named by a follow-up LLM call or extracted from seed
        seed=seed,
        theme=theme,
        geography=geography,
        factions=factions,
        characters=characters,
        events=[],
        rules=WorldRules(theme=theme, conflict_driver=seed),
        status="ready"
    )
```

**Step 3: Create the generation orchestrator**

`backend/generator.py`:
```python
import asyncio
import json
from llm import chat_completion, extract_json
from prompts import geography, factions, characters
from prompts.assembler import assemble_world
from models.world import World
from store import save_world

WORLD_NAME_SYSTEM = "You name fictional worlds. Respond with ONLY the name — 1-4 words, evocative and memorable. No quotes, no explanation."

async def generate_world(seed: str, num_regions: int = 6, num_factions: int = 4, num_characters: int = 15, on_progress=None) -> World:
    """Generate a complete world from a seed concept."""

    async def _notify(stage: str, detail: str = ""):
        if on_progress:
            await on_progress({"stage": stage, "detail": detail})

    await _notify("geography", "Generating terrain and regions...")

    # Phase 1: Geography (must complete first — factions need regions)
    geo_text = await chat_completion(geography.SYSTEM, geography.user_prompt(seed, num_regions))
    geo_data = extract_json(geo_text)
    await _notify("geography_done", f"{len(geo_data.get('regions', []))} regions created")

    # Phase 2: Factions + Characters in parallel (factions need geo, characters need both)
    await _notify("factions", "Generating factions...")
    faction_text = await chat_completion(factions.SYSTEM, factions.user_prompt(seed, geo_data.get("regions", []), num_factions))
    faction_data = extract_json(faction_text)
    await _notify("factions_done", f"{len(faction_data)} factions created")

    await _notify("characters", "Generating characters with genomes...")
    char_text = await chat_completion(characters.SYSTEM, characters.user_prompt(seed, faction_data, geo_data.get("regions", []), num_characters))
    char_data = extract_json(char_text)
    await _notify("characters_done", f"{len(char_data)} characters created")

    # Phase 3: Assemble world
    await _notify("assembling", "Assembling world...")
    world = assemble_world(seed, geo_data, faction_data, char_data)

    # Name the world
    name = await chat_completion(WORLD_NAME_SYSTEM, f"Name this world: {seed}")
    world.name = name.strip().strip('"').strip("'")

    # Save
    save_world(world)
    await _notify("complete", f"World '{world.name}' is alive")
    return world
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: LLM generation engine with geography/faction/character prompts"
```

---

## Task 4: API Routes

**Files:**
- Create: `backend/routes/__init__.py`
- Create: `backend/routes/worlds.py`
- Modify: `backend/main.py` — add routes + WebSocket

**Step 1: Create world API routes**

`backend/routes/__init__.py`: (empty)

`backend/routes/worlds.py`:
```python
import asyncio
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from store import list_worlds, load_world, save_world, delete_world
from generator import generate_world

router = APIRouter(prefix="/api/worlds", tags=["worlds"])

class CreateWorldRequest(BaseModel):
    seed: str
    num_regions: int = 6
    num_factions: int = 4
    num_characters: int = 15

# Active WebSocket connections per world
_ws_connections: dict[str, list[WebSocket]] = {}

@router.get("")
async def get_worlds():
    return list_worlds()

@router.post("")
async def create_world(req: CreateWorldRequest):
    async def progress_cb(data):
        world_id = data.get("world_id", "pending")
        for ws in _ws_connections.get(world_id, []):
            try:
                await ws.send_json(data)
            except Exception:
                pass

    world = await generate_world(req.seed, req.num_regions, req.num_factions, req.num_characters, on_progress=progress_cb)
    return {"id": world.id, "name": world.name, "status": world.status}

@router.get("/{world_id}")
async def get_world(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return world.model_dump()

@router.get("/{world_id}/map")
async def get_map(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    factions = {f.id: {"name": f.name, "color": f.color} for f in world.factions}
    return {"geography": world.geography.model_dump(), "factions": factions}

@router.get("/{world_id}/factions")
async def get_factions(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return [f.model_dump() for f in world.factions]

@router.get("/{world_id}/characters")
async def get_characters(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    return [c.model_dump() for c in world.characters]

@router.get("/{world_id}/characters/{char_id}")
async def get_character(world_id: str, char_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    char = next((c for c in world.characters if c.id == char_id), None)
    if not char:
        raise HTTPException(404, "Character not found")
    return char.model_dump()

@router.get("/{world_id}/events")
async def get_events(world_id: str, day: int | None = None):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    events = world.events
    if day is not None:
        events = [e for e in events if e.day == day]
    return [e.model_dump() for e in events]

@router.get("/{world_id}/evolution")
async def get_evolution(world_id: str):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")
    # Compute genome stats per generation
    from models.genome import TRAITS
    gen_stats = {}
    for c in world.characters:
        gen = c.lineage.generation
        if gen not in gen_stats:
            gen_stats[gen] = {t: [] for t in TRAITS}
            gen_stats[gen]["_count"] = 0
        gen_stats[gen]["_count"] += 1
        for t in TRAITS:
            gen_stats[gen][t].append(getattr(c.genome, t))
    result = []
    for gen, stats in sorted(gen_stats.items()):
        entry = {"generation": gen, "count": stats["_count"]}
        for t in TRAITS:
            entry[t] = round(sum(stats[t]) / len(stats[t]), 3) if stats[t] else 0
        result.append(entry)
    return result

@router.delete("/{world_id}")
async def remove_world(world_id: str):
    if delete_world(world_id):
        return {"deleted": True}
    raise HTTPException(404, "World not found")
```

**Step 2: Update main.py**

Replace `backend/main.py` with:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import HOST, PORT
from routes.worlds import router as worlds_router

app = FastAPI(title="Hermes Genesis", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(worlds_router)

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
```

**Step 3: Test API manually**

```bash
cd C:/Users/GUDMAN/Desktop/hermes-genesis/backend
python main.py &
curl http://localhost:8003/api/health
curl http://localhost:8003/api/worlds
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: API routes for worlds, map, factions, characters, events, evolution"
```

---

## Task 5: Simulation Engine

**Files:**
- Create: `backend/simulation.py`
- Create: `backend/prompts/narrator.py`
- Create: `backend/routes/simulate.py`
- Modify: `backend/main.py` — add simulate router
- Create: `backend/tests/test_simulation.py`

**Step 1: Create simulation engine**

`backend/simulation.py`:
```python
import random
from models.world import World
from models.event import Event, EventOutcome, CharacterEffect
from models.genome import Genome, TRAITS
from store import save_world

EVENT_TYPES = [
    ("military_conflict", ["courage", "resilience"], 0.25),
    ("political_intrigue", ["cunning", "ambition"], 0.2),
    ("betrayal", ["loyalty", "cunning"], 0.1),
    ("alliance", ["empathy", "cunning"], 0.15),
    ("discovery", ["courage", "resilience"], 0.1),
    ("succession", ["ambition", "cunning"], 0.05),
    ("cultural_shift", ["empathy", "resilience"], 0.1),
    ("natural_disaster", ["resilience", "courage"], 0.05),
]

def pick_event_type() -> tuple[str, list[str]]:
    r = random.random()
    cumulative = 0
    for etype, traits, prob in EVENT_TYPES:
        cumulative += prob
        if r <= cumulative:
            return etype, traits
    return EVENT_TYPES[0][0], EVENT_TYPES[0][1]

def resolve_conflict(char_a, char_b, relevant_traits: list[str]) -> tuple[str, str]:
    score_a = sum(getattr(char_a.genome, t, 0.5) for t in relevant_traits) / len(relevant_traits) + random.gauss(0, 0.1)
    score_b = sum(getattr(char_b.genome, t, 0.5) for t in relevant_traits) / len(relevant_traits) + random.gauss(0, 0.1)
    if score_a >= score_b:
        return char_a.id, char_b.id
    return char_b.id, char_a.id

def simulate_tick(world: World) -> list[Event]:
    """Advance the world by one day. Returns new events."""
    world.current_day += 1
    day = world.current_day
    events = []
    alive_chars = [c for c in world.characters if c.alive]
    if len(alive_chars) < 2:
        return events

    # Generate 1-3 events per tick
    num_events = random.randint(1, min(3, len(alive_chars) // 2))
    used_chars = set()

    for i in range(num_events):
        etype, relevant_traits = pick_event_type()
        available = [c for c in alive_chars if c.id not in used_chars]
        if len(available) < 2:
            break

        # Pick actors based on trait relevance
        weighted = [(c, sum(getattr(c.genome, t, 0.5) for t in relevant_traits)) for c in available]
        weighted.sort(key=lambda x: x[1], reverse=True)
        actor1 = weighted[0][0]
        # Second actor: prefer different faction for conflict, same for alliance
        if etype in ("military_conflict", "betrayal", "political_intrigue"):
            candidates = [w for w in weighted[1:] if w[0].faction_id != actor1.faction_id]
        else:
            candidates = weighted[1:]
        if not candidates:
            candidates = weighted[1:]
        actor2 = candidates[0][0] if candidates else weighted[-1][0]

        used_chars.add(actor1.id)
        used_chars.add(actor2.id)

        # Resolve
        winner_id, loser_id = resolve_conflict(actor1, actor2, relevant_traits)
        winner = actor1 if actor1.id == winner_id else actor2
        loser = actor1 if actor1.id == loser_id else actor2

        outcome = EventOutcome()
        char_effects = []

        # Apply outcomes
        if etype == "military_conflict":
            region = loser.location
            if region and winner.faction_id:
                outcome.territory_changes = {region: winner.faction_id}
                # Update region control
                for r in world.geography.regions:
                    if r.id == region:
                        r.controlled_by = winner.faction_id
                # Update faction territory
                for f in world.factions:
                    if f.id == winner.faction_id and region not in f.territory:
                        f.territory.append(region)
                    if f.id == loser.faction_id and region in f.territory:
                        f.territory.remove(region)
            char_effects.append(CharacterEffect(char_id=winner.id, effect="fitness_boost", value=0.1))
            char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness_drop", value=-0.15))

        elif etype == "betrayal":
            if loser.genome.loyalty < 0.4 and loser.genome.ambition > 0.6:
                # Betrayer succeeds
                loser.faction_id = winner.faction_id
                char_effects.append(CharacterEffect(char_id=loser.id, effect="faction_switch", value=winner.faction_id))
            else:
                char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness_drop", value=-0.2))

        elif etype == "alliance":
            f1 = winner.faction_id
            f2 = loser.faction_id
            if f1 != f2:
                for f in world.factions:
                    if f.id == f1 and f2 not in f.alliances:
                        f.alliances.append(f2)
                    if f.id == f2 and f1 not in f.alliances:
                        f.alliances.append(f1)

        elif etype == "natural_disaster":
            region = random.choice([r.id for r in world.geography.regions])
            for f in world.factions:
                if region in f.territory:
                    outcome.morale_changes[f.id] = -10
                    f.morale = max(0, f.morale - 10)

        elif etype == "succession":
            if loser.role == "leader":
                loser.role = "exile"
                winner.role = "leader"
                for f in world.factions:
                    if f.id == winner.faction_id:
                        f.leader_id = winner.id

        outcome.character_effects = char_effects

        # Update fitness
        for ce in char_effects:
            for c in world.characters:
                if c.id == ce.char_id and isinstance(ce.value, (int, float)):
                    c.fitness = max(0, min(1, c.fitness + ce.value))

        event = Event(
            id=f"evt_{day:03d}_{i+1:02d}",
            day=day,
            type=etype,
            title=f"{etype.replace('_', ' ').title()}: {winner.name} vs {loser.name}",
            actors=[actor1.id, actor2.id],
            factions_involved=list(set([actor1.faction_id, actor2.faction_id])),
            regions_affected=[actor1.location or actor2.location],
            outcome=outcome,
            narrative=""
        )
        events.append(event)

    # Genome evolution: low-fitness characters might die, high-fitness might spawn successors
    for c in alive_chars:
        if c.fitness < 0.15 and random.random() < 0.3:
            c.alive = False
            events.append(Event(
                id=f"evt_{day:03d}_death_{c.id}",
                day=day, type="death",
                title=f"{c.name} has fallen",
                actors=[c.id],
                factions_involved=[c.faction_id],
                regions_affected=[c.location],
                narrative=""
            ))

    # Crossover: top 2 fitness chars from same faction may produce successor
    for f in world.factions:
        faction_chars = sorted([c for c in alive_chars if c.faction_id == f.id and c.alive], key=lambda c: c.fitness, reverse=True)
        if len(faction_chars) >= 2 and random.random() < 0.15:
            p1, p2 = faction_chars[0], faction_chars[1]
            child_genome = Genome.crossover(p1.genome, p2.genome)
            child_id = f"char_{len(world.characters)+1:02d}"
            from models.character import Character, Lineage
            child = Character(
                id=child_id,
                name=f"Successor of {p1.name.split()[0]}",
                faction_id=f.id,
                role="protege",
                age=18,
                location=p1.location,
                backstory=f"Mentored by {p1.name} and {p2.name}",
                goals=["prove_worthy"],
                genome=child_genome,
                lineage=Lineage(parent_ids=[p1.id, p2.id], generation=max(p1.lineage.generation, p2.lineage.generation) + 1),
                fitness=0.5
            )
            world.characters.append(child)

    world.events.extend(events)
    save_world(world)
    return events
```

`backend/prompts/narrator.py`:
```python
SYSTEM = """You are a narrator for a living fictional world. Write vivid, concise prose about world events.
Each narrative should be 2-4 sentences — atmospheric, dramatic, and specific to the characters involved.
Write in past tense, third person. No meta-commentary."""

def event_prompt(event_data: dict, world_context: str) -> str:
    return f"""World context: {world_context}

Write a narrative for this event:
Type: {event_data['type']}
Title: {event_data['title']}
Actors: {event_data['actors']}
Factions: {event_data['factions_involved']}
Regions: {event_data['regions_affected']}
Outcome: {event_data.get('outcome', {})}

Write 2-4 vivid sentences. Be specific about names and places."""
```

**Step 2: Create simulate route**

`backend/routes/simulate.py`:
```python
from fastapi import APIRouter, HTTPException
from store import load_world
from simulation import simulate_tick
from llm import chat_completion
from prompts.narrator import SYSTEM as NARRATOR_SYSTEM, event_prompt

router = APIRouter(prefix="/api/worlds", tags=["simulation"])

@router.post("/{world_id}/simulate")
async def run_simulation(world_id: str, days: int = 1):
    world = load_world(world_id)
    if not world:
        raise HTTPException(404, "World not found")

    all_events = []
    for _ in range(days):
        events = simulate_tick(world)
        # Reload world after tick (simulate_tick saves it)
        world = load_world(world_id)

        # Generate narratives for events
        world_ctx = f"{world.name}: {world.seed} (Day {world.current_day})"
        for event in events:
            if event.type != "death":
                try:
                    narrative = await chat_completion(NARRATOR_SYSTEM, event_prompt(event.model_dump(), world_ctx), max_tokens=300)
                    event.narrative = narrative.strip()
                    # Update in world
                    for e in world.events:
                        if e.id == event.id:
                            e.narrative = event.narrative
                except Exception:
                    event.narrative = event.title

        from store import save_world
        save_world(world)
        all_events.extend(events)

    return {
        "world_id": world_id,
        "days_simulated": days,
        "current_day": world.current_day,
        "events": [e.model_dump() for e in all_events]
    }
```

**Step 3: Add simulate router to main.py**

Add to `backend/main.py` after worlds_router import:
```python
from routes.simulate import router as simulate_router
# ... after app.include_router(worlds_router):
app.include_router(simulate_router)
```

**Step 4: Write simulation tests**

`backend/tests/test_simulation.py`:
```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.world import World, WorldRules
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character, Genome, Lineage
from simulation import simulate_tick, resolve_conflict, pick_event_type

def make_test_world():
    regions = [
        Region(id="region_01", name="North", type="plains", climate="temperate", x=0.3, y=0.2, controlled_by="faction_01"),
        Region(id="region_02", name="South", type="desert", climate="arid", x=0.7, y=0.8, controlled_by="faction_02"),
    ]
    factions = [
        Faction(id="faction_01", name="Northerners", ideology="expansionist", color="#ff0000", territory=["region_01"], population=1000, morale=70),
        Faction(id="faction_02", name="Southerners", ideology="isolationist", color="#0000ff", territory=["region_02"], population=800, morale=60),
    ]
    characters = [
        Character(id="char_01", name="Lord North", faction_id="faction_01", role="leader", location="region_01",
                  genome=Genome(courage=0.9, cunning=0.7, loyalty=0.8, ambition=0.6, empathy=0.3, resilience=0.8), fitness=0.7),
        Character(id="char_02", name="Duke South", faction_id="faction_02", role="leader", location="region_02",
                  genome=Genome(courage=0.5, cunning=0.9, loyalty=0.6, ambition=0.9, empathy=0.4, resilience=0.5), fitness=0.6),
        Character(id="char_03", name="Spy Shadow", faction_id="faction_01", role="spy", location="region_01",
                  genome=Genome(courage=0.4, cunning=0.95, loyalty=0.3, ambition=0.85, empathy=0.2, resilience=0.6), fitness=0.5),
        Character(id="char_04", name="Healer Grace", faction_id="faction_02", role="healer", location="region_02",
                  genome=Genome(courage=0.3, cunning=0.4, loyalty=0.9, ambition=0.2, empathy=0.95, resilience=0.7), fitness=0.5),
    ]
    return World(
        id="world_test",
        name="Test World",
        seed="test",
        geography=Geography(regions=regions, connections=[Connection(from_region="region_01", to_region="region_02")]),
        factions=factions,
        characters=characters,
        rules=WorldRules(theme="test"),
        status="ready"
    )

def test_pick_event_type():
    etype, traits = pick_event_type()
    assert isinstance(etype, str)
    assert len(traits) >= 1

def test_resolve_conflict():
    c1 = Character(id="a", name="Strong", genome=Genome(courage=1.0, cunning=1.0, loyalty=1.0, ambition=1.0, empathy=1.0, resilience=1.0))
    c2 = Character(id="b", name="Weak", genome=Genome(courage=0.0, cunning=0.0, loyalty=0.0, ambition=0.0, empathy=0.0, resilience=0.0))
    # Run 100 times — the strong character should win most
    wins = sum(1 for _ in range(100) if resolve_conflict(c1, c2, ["courage", "resilience"])[0] == "a")
    assert wins > 70

def test_simulate_tick(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    import config
    config.DATA_DIR = str(tmp_path)
    import store
    store.DATA_DIR = str(tmp_path)

    world = make_test_world()
    store.save_world(world)
    events = simulate_tick(world)
    assert world.current_day == 1
    assert len(events) >= 1
    assert all(isinstance(e, type(events[0])) for e in events)
```

**Step 5: Run tests**

```bash
cd C:/Users/GUDMAN/Desktop/hermes-genesis/backend && python -m pytest tests/ -v
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: simulation engine with genome evolution and narrative generation"
```

---

## Task 6: React Frontend — Layout, Router, API Client

**Files:**
- Create: `frontend/src/api.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/pages/Home.tsx`
- Create: `frontend/src/pages/WorldView.tsx`
- Modify: `frontend/src/App.tsx` — add router

**Step 1: Create TypeScript types**

`frontend/src/types.ts` — Pydantic models mirrored in TypeScript (all interfaces for World, Region, Faction, Character, Genome, Event, etc.)

**Step 2: Create API client**

`frontend/src/api.ts` — fetch wrapper for all `/api/worlds` endpoints

**Step 3: Create Layout component**

Dark-themed shell with nav header (logo, links) and content area.

**Step 4: Create Home page**

Seed input form, world list, create button with loading state.

**Step 5: Create WorldView page**

Tabbed layout: Map | Factions | Characters | Events | Evolution. Each tab loads a dedicated component.

**Step 6: Wire router in App.tsx**

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/world/:id" element={<WorldView />} />
  </Routes>
</BrowserRouter>
```

**Step 7: Verify dev server**

```bash
cd C:/Users/GUDMAN/Desktop/hermes-genesis/frontend && npm run dev
```

**Step 8: Commit**

```bash
git add -A && git commit -m "feat: React frontend layout, routing, API client"
```

---

## Task 7: Interactive SVG World Map

**Files:**
- Create: `frontend/src/components/WorldMap.tsx`
- Create: `frontend/src/components/RegionDetail.tsx`

**Step 1: Build WorldMap component**

SVG-based map using D3 force layout to position region nodes:
- Regions as rounded rectangles with faction color fill (opacity 0.3) and border
- Region names as text labels
- Connection lines between neighbors (solid=road, dashed=contested)
- Resource icons as small circles
- Click region → side panel with details
- Animated pulse on conflict regions
- Zoom/pan via SVG viewBox + mouse drag

**Step 2: Build RegionDetail panel**

Slide-in panel showing: region name, type, climate, resources, controlling faction, points of interest, characters present.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: interactive SVG world map with faction territories"
```

---

## Task 8: Faction Dashboard + Character Profiles

**Files:**
- Create: `frontend/src/components/FactionCard.tsx`
- Create: `frontend/src/components/FactionDashboard.tsx`
- Create: `frontend/src/components/CharacterCard.tsx`
- Create: `frontend/src/components/CharacterList.tsx`
- Create: `frontend/src/components/GenomeRadar.tsx`
- Create: `frontend/src/components/CharacterDetail.tsx`

**Step 1: FactionCard + FactionDashboard**

Card per faction: name, ideology, color bar, resource bars (military/economy/tech/influence), territory count, population, morale gauge, leader name, alliance/enemy badges.

**Step 2: GenomeRadar**

Recharts RadarChart showing 6 genome traits. Reusable for any character.

**Step 3: CharacterCard + CharacterDetail**

Card: name, role badge, faction color dot, age, genome mini-bars. Detail view: full genome radar, backstory, goals, relationships list, lineage info.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: faction dashboard + character profiles with genome radar"
```

---

## Task 9: Event Timeline + Evolution View

**Files:**
- Create: `frontend/src/components/EventTimeline.tsx`
- Create: `frontend/src/components/EventCard.tsx`
- Create: `frontend/src/components/EvolutionView.tsx`
- Create: `frontend/src/components/SimulateButton.tsx`

**Step 1: EventTimeline**

Vertical timeline with day markers. Each event: type icon, title, narrative text, actor names, faction badges, outcome summary. Filter by: event type, faction, character.

**Step 2: EventCard**

Individual event display with expandable narrative and outcome details.

**Step 3: EvolutionView**

Recharts LineChart showing average genome trait values over generations. Trait selector toggles. Population count over time. "Natural selection pressure" indicator showing which traits are being selected for.

**Step 4: SimulateButton**

"Advance Day" button that calls POST /simulate, shows loading animation, then refreshes all views. Option to advance multiple days (1, 5, 10).

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: event timeline + evolution view + simulation controls"
```

---

## Task 10: Landing Page + Polish

**Files:**
- Create: `frontend/src/pages/Landing.tsx`
- Create: `frontend/src/components/SeedInput.tsx`
- Modify: various components for animations and polish

**Step 1: Landing page**

Hero section: "Describe a world. Watch it live." with animated background (subtle particle or grid effect). Large seed input with placeholder examples. "Generate World" CTA button. Below: feature cards (Generate, Explore, Simulate, Evolve). Recent worlds gallery.

**Step 2: SeedInput component**

Textarea with rotating placeholder suggestions. Character count. "Example: post-apocalyptic wasteland with three rival settlements" cycling through 5 examples.

**Step 3: Animations**

Framer Motion: page transitions, card hover effects, map region hover glow, loading states with skeleton screens. Generation progress: step indicators (Geography → Factions → Characters → Ready).

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: landing page with seed input + UI polish"
```

---

## Task 11: Hermes-Agent Skills

**Files:**
- Create: `skills/genesis-worldbuilder/SKILL.md`
- Create: `skills/genesis-simulator/SKILL.md`

**Step 1: Create worldbuilder skill**

```markdown
---
name: genesis-worldbuilder
description: Generate a complete living world from a natural language concept
version: 1.0.0
metadata:
  hermes:
    tags: [worldbuilding, procedural-generation, fiction, creative]
    related_skills: [genesis-simulator]
    category: creative
---

# Genesis Worldbuilder

## When to Use
When a user asks to create a world, generate a fictional setting, or build a universe.

## Procedure

1. Parse the user's world concept into a seed description
2. Use delegate_task with 3 parallel tasks to generate world elements:
   - Task 1: Generate geography (6 regions with terrain, climate, resources)
   - Task 2: Generate factions (4 factions with ideologies, territories)
   - Task 3: Generate characters (15 characters with genomes, goals)
3. Assemble the world data and save to the Genesis API
4. Deploy/update the web explorer
5. Schedule a cron job for ongoing simulation
6. Send the world summary to the user
...
```

**Step 2: Create simulator skill**

Similar SKILL.md for the simulation tick — loads world, runs simulation, narrates events, delivers via Telegram.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: hermes-agent skills for worldbuilding and simulation"
```

---

## Task 12: Docker + VPS Deployment

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `nginx.conf`
- Create: `deploy.sh`

**Step 1: Dockerfile**

Multi-stage: Node build stage (frontend) → Python runtime stage (backend + static frontend).

**Step 2: docker-compose.yml**

Single service with volume mount for `/app/data`, port 8003, env vars from `.env`.

**Step 3: nginx.conf**

Server block for genesis domain: `/` serves frontend dist, `/api/` proxies to 8003, `/ws/` proxies with websocket upgrade.

**Step 4: deploy.sh**

Script that SSHes to VPS, pulls code, builds Docker, restarts containers, reloads nginx.

**Step 5: Deploy and verify**

```bash
bash deploy.sh
curl https://genesis.hermes-ouroboros.online/api/health
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: Docker deployment + nginx config"
```

---

## Task 13: Demo Video + Submission

**Step 1: Record demo video (3-5 minutes)**

Follow the demo script from the design doc:
1. Show the landing page, explain the concept
2. Type a seed, watch generation progress
3. Explore the map, click regions, show factions
4. Open character profiles, show genome radar charts
5. Simulate 5 days, show events appearing
6. Show evolution view — trait distributions shifting
7. Show Telegram message arriving with narrative

**Step 2: Write tweet thread**

Tag @NousResearch. Brief writeup of what Genesis does and why it's unique.

**Step 3: Submit to Discord channel**

Post tweet link in #hackathon-submissions.

---

## Priority Order (if behind schedule)

1. Tasks 1-4 (backend core) — **MUST SHIP**
2. Tasks 6-7 (frontend + map) — **MUST SHIP**
3. Task 5 (simulation) — **MUST SHIP**
4. Tasks 8-9 (factions, characters, timeline) — **HIGH PRIORITY**
5. Task 10 (landing + polish) — **MEDIUM**
6. Task 12 (deployment) — **MUST SHIP**
7. Task 11 (hermes skills) — **NICE TO HAVE**
8. Task 13 (demo + submit) — **MUST SHIP**
