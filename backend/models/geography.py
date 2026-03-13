from typing import Optional
from pydantic import BaseModel, Field

class PointOfInterest(BaseModel):
    name: str
    type: str
    significance: str

class Region(BaseModel):
    id: str
    name: str
    type: str
    climate: str
    resources: list[str] = Field(default_factory=list)
    controlled_by: Optional[str] = None
    neighbors: list[str] = Field(default_factory=list)
    points_of_interest: list[PointOfInterest] = Field(default_factory=list)
    x: float = 0.5
    y: float = 0.5
    description: str = ""

class Connection(BaseModel):
    from_region: str
    to_region: str
    type: str = "road"
    control: str = "neutral"

class Geography(BaseModel):
    regions: list[Region] = Field(default_factory=list)
    connections: list[Connection] = Field(default_factory=list)
