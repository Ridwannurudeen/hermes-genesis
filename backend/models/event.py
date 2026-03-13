from pydantic import BaseModel, Field

class CharacterEffect(BaseModel):
    char_id: str
    effect: str
    value: float | bool | str = 0

class EventOutcome(BaseModel):
    territory_changes: dict[str, str] = Field(default_factory=dict)
    casualties: dict[str, int] = Field(default_factory=dict)
    morale_changes: dict[str, int] = Field(default_factory=dict)
    resource_changes: dict[str, dict[str, int]] = Field(default_factory=dict)
    character_effects: list[CharacterEffect] = Field(default_factory=list)

class Event(BaseModel):
    id: str
    day: int
    type: str
    title: str
    description: str = ""
    actors: list[str] = Field(default_factory=list)
    factions_involved: list[str] = Field(default_factory=list)
    regions_affected: list[str] = Field(default_factory=list)
    outcome: EventOutcome = Field(default_factory=EventOutcome)
    narrative: str = ""
    obituary: str = ""
    caused_by: str = ""
    agent_triggered: bool = False
    user_triggered: bool = False
    prophecy_id: str = ""
