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
