import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

os.environ["DATA_DIR"] = os.path.join(os.path.dirname(__file__), "tmp_test_data")

from models.world import World, WorldRules
from models.geography import Geography, Region, Connection
from models.faction import Faction
from models.character import Character, Lineage
from models.genome import Genome
from simulation import simulate_tick, resolve_conflict, pick_event_type
import store

store.DATA_DIR = os.environ["DATA_DIR"]

def make_test_world():
    regions = [
        Region(id="region_01", name="North", type="plains", climate="temperate", x=0.3, y=0.2, controlled_by="faction_01"),
        Region(id="region_02", name="South", type="desert", climate="arid", x=0.7, y=0.8, controlled_by="faction_02"),
    ]
    factions = [
        Faction(id="faction_01", name="Northerners", ideology="expansionist", color="#ff0000", territory=["region_01"], population=1000, morale=70),
        Faction(id="faction_02", name="Southerners", ideology="isolationist", color="#0000ff", territory=["region_02"], population=800, morale=60),
    ]
    characters = [
        Character(id="char_01", name="Lord North", faction_id="faction_01", role="leader", location="region_01",
                  genome=Genome(courage=0.9, cunning=0.7, loyalty=0.8, ambition=0.6, empathy=0.3, resilience=0.8), fitness=0.7),
        Character(id="char_02", name="Duke South", faction_id="faction_02", role="leader", location="region_02",
                  genome=Genome(courage=0.5, cunning=0.9, loyalty=0.6, ambition=0.9, empathy=0.4, resilience=0.5), fitness=0.6),
        Character(id="char_03", name="Spy Shadow", faction_id="faction_01", role="spy", location="region_01",
                  genome=Genome(courage=0.4, cunning=0.95, loyalty=0.3, ambition=0.85, empathy=0.2, resilience=0.6), fitness=0.5),
        Character(id="char_04", name="Healer Grace", faction_id="faction_02", role="healer", location="region_02",
                  genome=Genome(courage=0.3, cunning=0.4, loyalty=0.9, ambition=0.2, empathy=0.95, resilience=0.7), fitness=0.5),
    ]
    return World(
        id="world_test", name="Test World", seed="test",
        geography=Geography(regions=regions, connections=[Connection(from_region="region_01", to_region="region_02")]),
        factions=factions, characters=characters,
        rules=WorldRules(theme="test"), status="ready"
    )

def test_pick_event_type():
    for _ in range(100):
        etype, traits = pick_event_type()
        assert isinstance(etype, str)
        assert len(traits) >= 1

def test_resolve_conflict():
    c1 = Character(id="a", name="Strong", genome=Genome(courage=1.0, cunning=1.0, loyalty=1.0, ambition=1.0, empathy=1.0, resilience=1.0))
    c2 = Character(id="b", name="Weak", genome=Genome(courage=0.0, cunning=0.0, loyalty=0.0, ambition=0.0, empathy=0.0, resilience=0.0))
    wins = sum(1 for _ in range(100) if resolve_conflict(c1, c2, ["courage", "resilience"])[0] == "a")
    assert wins > 70

def test_simulate_tick():
    world = make_test_world()
    store.save_world(world)
    events = simulate_tick(world)
    assert world.current_day == 1
    assert len(events) >= 1

    # Cleanup
    import shutil
    test_dir = os.environ["DATA_DIR"]
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
