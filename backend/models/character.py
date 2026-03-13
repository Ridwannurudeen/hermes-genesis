from typing import Optional
from pydantic import BaseModel, Field
from .genome import Genome

class Lineage(BaseModel):
    parent_ids: list[str] = Field(default_factory=list)
    generation: int = 0
    mutations: list[str] = Field(default_factory=list)

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
    goals: list[str] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)
    genome: Genome = Field(default_factory=Genome)
    lineage: Lineage = Field(default_factory=Lineage)
    fitness: float = 0.5
