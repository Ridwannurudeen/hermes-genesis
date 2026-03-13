from pydantic import BaseModel, Field

class Faction(BaseModel):
    id: str
    name: str
    ideology: str
    color: str = "#666666"
    leader_id: str = ""
    territory: list[str] = Field(default_factory=list)
    resources: dict[str, int] = Field(default_factory=dict)
    alliances: list[str] = Field(default_factory=list)
    enemies: list[str] = Field(default_factory=list)
    population: int = 1000
    morale: int = 50
    traits: list[str] = Field(default_factory=list)
    description: str = ""
