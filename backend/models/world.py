from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Literal
from .geography import Geography
from .faction import Faction
from .character import Character
from .event import Event

WorldVisibility = Literal["private", "unlisted", "public"]

class Prophecy(BaseModel):
    id: str
    text: str  # The cryptic prophecy text
    hint: str = ""  # Hidden condition for fulfillment
    fulfilled: bool = False
    fulfilled_day: int | None = None
    fulfilled_event_id: str = ""

class WorldRules(BaseModel):
    theme: str = ""
    magic_level: str = "none"
    tech_level: str = "medieval"
    conflict_driver: str = ""
    special_rules: list[str] = Field(default_factory=list)

class World(BaseModel):
    id: str
    name: str
    seed: str
    theme: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    current_day: int = 0
    geography: Geography = Field(default_factory=Geography)
    factions: list[Faction] = Field(default_factory=list)
    characters: list[Character] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    rules: WorldRules = Field(default_factory=WorldRules)
    prophecies: list[Prophecy] = Field(default_factory=list)
    status: str = "generating"
    # visibility: "public" → appears in /api/worlds with full seed (curated demos);
    # "unlisted" → not in public list, accessible via direct URL (default);
    # "private" → only admin (X-API-Key) can list/access via the explicit admin path.
    visibility: WorldVisibility = "unlisted"
    faction_snapshots: list[dict] = Field(default_factory=list)
    agent_logs: list[dict] = Field(default_factory=list)
