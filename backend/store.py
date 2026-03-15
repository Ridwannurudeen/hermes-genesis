import asyncio
import json
import os
import tempfile
from pathlib import Path
from filelock import FileLock, Timeout
from models.world import World
from config import DATA_DIR

# Shared semaphore: limits concurrent world creations across all routes
creation_semaphore = asyncio.Semaphore(2)

# Per-world asyncio locks serialise coroutines inside the event loop.
# Combined with file-based locks below, this covers both single-process
# async races AND multi-worker / multi-process deployments.
_world_locks: dict[str, asyncio.Lock] = {}

# File-lock timeout (seconds) — prevents deadlock if a process crashes
_FILE_LOCK_TIMEOUT = 10


def get_lock(world_id: str) -> asyncio.Lock:
    """Get or create an asyncio.Lock for a specific world."""
    if world_id not in _world_locks:
        _world_locks[world_id] = asyncio.Lock()
    return _world_locks[world_id]


def _world_path(world_id: str) -> Path:
    # Sanitize: strip any path separators to prevent directory traversal
    safe_id = world_id.replace("/", "").replace("\\", "").replace("..", "")
    return Path(DATA_DIR) / f"{safe_id}.json"


def _lock_path(world_id: str) -> Path:
    """Return the file-lock path for a world (cross-process safety)."""
    safe_id = world_id.replace("/", "").replace("\\", "").replace("..", "")
    return Path(DATA_DIR) / f".{safe_id}.lock"


def save_world(world: World) -> None:
    """Atomic write with cross-process file lock."""
    path = _world_path(world.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(world.model_dump(), indent=2)

    flock = FileLock(_lock_path(world.id), timeout=_FILE_LOCK_TIMEOUT)
    try:
        with flock:
            fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    f.write(data)
                os.replace(tmp_path, str(path))
            except Exception:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
                raise
    except Timeout:
        raise RuntimeError(f"Could not acquire file lock for world {world.id}")


def load_world(world_id: str) -> World | None:
    path = _world_path(world_id)
    if not path.exists():
        return None
    flock = FileLock(_lock_path(world_id), timeout=_FILE_LOCK_TIMEOUT)
    try:
        with flock:
            return World.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except Timeout:
        raise RuntimeError(f"Could not acquire file lock for world {world_id}")


def list_worlds() -> list[dict]:
    d = Path(DATA_DIR)
    if not d.exists():
        return []
    worlds = []
    for f in sorted(d.glob("world_*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            w = json.loads(f.read_text(encoding="utf-8"))
            worlds.append({"id": w["id"], "name": w["name"], "seed": w["seed"], "theme": w.get("theme", ""), "current_day": w.get("current_day", 0), "status": w.get("status", "ready"), "created_at": w.get("created_at", "")})
        except Exception:
            continue
    return worlds


def delete_world(world_id: str) -> bool:
    """Delete a world file. Caller MUST hold the per-world lock."""
    path = _world_path(world_id)
    if path.exists():
        path.unlink()
        # Clean up lock file too
        lp = _lock_path(world_id)
        try:
            lp.unlink(missing_ok=True)
        except OSError:
            pass
        return True
    return False


def cleanup_lock(world_id: str) -> None:
    """Remove the lock entry AFTER the lock is released and delete is done."""
    _world_locks.pop(world_id, None)


async def locked_update(world_id: str, updater):
    """Acquire per-world lock, load world, run updater(world), save result.

    updater is an async callable that takes a World and returns (World, result).
    The result is returned to the caller.
    """
    lock = get_lock(world_id)
    async with lock:
        world = load_world(world_id)
        if world is None:
            return None, None
        world, result = await updater(world)
        save_world(world)
        return world, result
