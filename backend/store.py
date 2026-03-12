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
