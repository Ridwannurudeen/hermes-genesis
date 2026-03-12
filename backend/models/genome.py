import random
from pydantic import BaseModel, Field

TRAITS = ["courage", "cunning", "loyalty", "ambition", "empathy", "resilience"]

class Genome(BaseModel):
    courage: float = Field(default_factory=lambda: round(random.uniform(0.2, 0.9), 3))
    cunning: float = Field(default_factory=lambda: round(random.uniform(0.2, 0.9), 3))
    loyalty: float = Field(default_factory=lambda: round(random.uniform(0.2, 0.9), 3))
    ambition: float = Field(default_factory=lambda: round(random.uniform(0.2, 0.9), 3))
    empathy: float = Field(default_factory=lambda: round(random.uniform(0.2, 0.9), 3))
    resilience: float = Field(default_factory=lambda: round(random.uniform(0.2, 0.9), 3))

    def to_dict(self) -> dict:
        return {t: getattr(self, t) for t in TRAITS}

    @staticmethod
    def crossover(parent_a: "Genome", parent_b: "Genome", mutation_rate: float = 0.1) -> "Genome":
        child = {}
        for trait in TRAITS:
            val = getattr(parent_a, trait) if random.random() < 0.5 else getattr(parent_b, trait)
            if random.random() < mutation_rate:
                val = max(0.0, min(1.0, val + random.gauss(0, 0.1)))
            child[trait] = round(val, 3)
        return Genome(**child)

    def fitness(self, survival: float, influence: float, goals: float, relationships: float) -> float:
        return round(0.3 * survival + 0.25 * influence + 0.25 * goals + 0.2 * relationships, 3)
