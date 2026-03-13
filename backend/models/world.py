from pydantic import BaseModel, Field
from datetime import datetime
from .geography import Geography
from .faction import Faction
from .character import Character
from .event import Event

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
    prophecies: list[Prophecy] = []
    status: str = "generating"
    faction_snapshots: list[dict] = []
    agent_logs: list[dict] = []
