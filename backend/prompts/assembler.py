import uuid
from models.world import World, WorldRules
from models.geography import Geography, Region, Connection, PointOfInterest
from models.faction import Faction
from models.character import Character, Lineage, Relationship
from models.genome import Genome

def assemble_world(seed: str, geo_data: dict, faction_data: list, char_data: list) -> World:
    world_id = f"world_{uuid.uuid4().hex[:12]}"

    regions = []
    for r in geo_data.get("regions", []):
        pois = [PointOfInterest(**p) for p in r.pop("points_of_interest", [])]
        regions.append(Region(**r, points_of_interest=pois) if pois else Region(**r))
    connections = [Connection(**c) for c in geo_data.get("connections", [])]
    geography = Geography(regions=regions, connections=connections)

    factions = [Faction(**f) for f in faction_data]

    characters = []
    for c in char_data:
        genome_data = c.pop("genome", {})
        rels_data = c.pop("relationships", [])
        relationships = [Relationship(**r) for r in rels_data]
        characters.append(Character(
            **c,
            genome=Genome(**genome_data),
            relationships=relationships,
            lineage=Lineage(generation=0)
        ))

    for char in characters:
        if char.role == "leader":
            for f in factions:
                if f.id == char.faction_id:
                    f.leader_id = char.id

    for f in factions:
        for region in regions:
            if region.id in f.territory:
                region.controlled_by = f.id

    theme = seed.split(",")[0].strip() if "," in seed else seed[:50]

    return World(
        id=world_id, name="", seed=seed, theme=theme,
        geography=geography, factions=factions, characters=characters,
        events=[], rules=WorldRules(theme=theme, conflict_driver=seed),
        status="ready"
    )
