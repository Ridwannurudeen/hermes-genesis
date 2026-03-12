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
