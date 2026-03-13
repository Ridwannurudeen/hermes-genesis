import random
from models.world import World
from models.event import Event, EventOutcome, CharacterEffect
from models.character import Character, Lineage, Relationship
from models.genome import Genome, TRAITS
from store import save_world

EVENT_TYPES = [
    ("military_conflict", ["courage", "resilience"], 0.25),
    ("political_intrigue", ["cunning", "ambition"], 0.2),
    ("betrayal", ["loyalty", "cunning"], 0.1),
    ("alliance", ["empathy", "cunning"], 0.15),
    ("discovery", ["courage", "resilience"], 0.1),
    ("succession", ["ambition", "cunning"], 0.05),
    ("cultural_shift", ["empathy", "resilience"], 0.1),
    ("natural_disaster", ["resilience", "courage"], 0.05),
]

def pick_event_type() -> tuple[str, list[str]]:
    r = random.random()
    cumulative = 0
    for etype, traits, prob in EVENT_TYPES:
        cumulative += prob
        if r <= cumulative:
            return etype, traits
    return EVENT_TYPES[0][0], EVENT_TYPES[0][1]

def resolve_conflict(char_a, char_b, relevant_traits: list[str]) -> tuple[str, str]:
    score_a = sum(getattr(char_a.genome, t, 0.5) for t in relevant_traits) / len(relevant_traits) + random.gauss(0, 0.1)
    score_b = sum(getattr(char_b.genome, t, 0.5) for t in relevant_traits) / len(relevant_traits) + random.gauss(0, 0.1)
    if score_a >= score_b:
        return char_a.id, char_b.id
    return char_b.id, char_a.id

CHAIN_RULES: dict[str, list[tuple[str, float]]] = {
    "betrayal": [("military_conflict", 0.4)],
    "military_conflict": [("succession", 0.3)],
    "succession": [("political_intrigue", 0.25)],
    "alliance": [("cultural_shift", 0.2)],
    "natural_disaster": [("military_conflict", 0.35)],
}

def _maybe_chain_event(
    parent: Event,
    world: World,
    day: int,
    event_counter: int,
) -> Event | None:
    """Roll for a consequent event triggered by the parent event.

    Returns a new Event with caused_by set, or None if no chain fires.
    """
    rules = CHAIN_RULES.get(parent.type)
    if not rules:
        return None

    for chain_type, probability in rules:
        if random.random() >= probability:
            continue

        # Find two alive characters to participate in the chained event
        alive = [c for c in world.characters if c.alive]
        if len(alive) < 2:
            return None

        # Prefer actors from the parent event's factions
        parent_factions = set(parent.factions_involved)
        faction_chars = [c for c in alive if c.faction_id in parent_factions]
        other_chars = [c for c in alive if c.faction_id not in parent_factions]

        if len(faction_chars) >= 1 and other_chars:
            actor1 = random.choice(faction_chars)
            actor2 = random.choice(other_chars)
        elif len(alive) >= 2:
            picks = random.sample(alive, 2)
            actor1, actor2 = picks[0], picks[1]
        else:
            return None

        # Resolve who wins
        trait_map = {t: traits for t, traits, _ in EVENT_TYPES}
        relevant = trait_map.get(chain_type, ["courage", "resilience"])
        winner_id, loser_id = resolve_conflict(actor1, actor2, relevant)
        winner = actor1 if actor1.id == winner_id else actor2
        loser = actor1 if actor1.id == loser_id else actor2

        return Event(
            id=f"evt_{day:03d}_chain_{event_counter:02d}",
            day=day,
            type=chain_type,
            title=f"{chain_type.replace('_', ' ').title()}: {winner.name} vs {loser.name} (consequence)",
            actors=[actor1.id, actor2.id],
            factions_involved=list(set(filter(None, [actor1.faction_id, actor2.faction_id]))),
            regions_affected=list(filter(None, [actor1.location or actor2.location])),
            outcome=EventOutcome(),
            narrative="",
            caused_by=parent.id,
        )

    return None


def simulate_tick(world: World) -> list[Event]:
    world.current_day += 1
    day = world.current_day
    events = []
    alive_chars = [c for c in world.characters if c.alive]
    if len(alive_chars) < 2:
        return events

    num_events = random.randint(1, min(3, len(alive_chars) // 2))
    used_chars = set()

    for i in range(num_events):
        etype, relevant_traits = pick_event_type()
        available = [c for c in alive_chars if c.id not in used_chars]
        if len(available) < 2:
            break

        weighted = [(c, sum(getattr(c.genome, t, 0.5) for t in relevant_traits)) for c in available]
        weighted.sort(key=lambda x: x[1], reverse=True)
        actor1 = weighted[0][0]

        if etype in ("military_conflict", "betrayal", "political_intrigue"):
            candidates = [w for w in weighted[1:] if w[0].faction_id != actor1.faction_id]
        else:
            candidates = weighted[1:]
        if not candidates:
            candidates = weighted[1:]
        actor2 = candidates[0][0] if candidates else weighted[-1][0]

        used_chars.add(actor1.id)
        used_chars.add(actor2.id)

        winner_id, loser_id = resolve_conflict(actor1, actor2, relevant_traits)
        winner = actor1 if actor1.id == winner_id else actor2
        loser = actor1 if actor1.id == loser_id else actor2

        outcome = EventOutcome()
        char_effects = []

        if etype == "military_conflict":
            region = loser.location
            if region and winner.faction_id:
                outcome.territory_changes = {region: winner.faction_id}
                for r in world.geography.regions:
                    if r.id == region:
                        r.controlled_by = winner.faction_id
                for f in world.factions:
                    if f.id == winner.faction_id and region not in f.territory:
                        f.territory.append(region)
                    if f.id == loser.faction_id and region in f.territory:
                        f.territory.remove(region)
            char_effects.append(CharacterEffect(char_id=winner.id, effect="fitness_boost", value=0.1))
            char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness_drop", value=-0.15))

        elif etype == "betrayal":
            if loser.genome.loyalty < 0.4 and loser.genome.ambition > 0.6:
                loser.faction_id = winner.faction_id
                char_effects.append(CharacterEffect(char_id=loser.id, effect="faction_switch", value=winner.faction_id))
            else:
                char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness_drop", value=-0.2))

        elif etype == "alliance":
            f1, f2 = winner.faction_id, loser.faction_id
            if f1 != f2:
                for f in world.factions:
                    if f.id == f1 and f2 not in f.alliances:
                        f.alliances.append(f2)
                    if f.id == f2 and f1 not in f.alliances:
                        f.alliances.append(f1)

        elif etype == "natural_disaster":
            region = random.choice([r.id for r in world.geography.regions]) if world.geography.regions else ""
            for f in world.factions:
                if region in f.territory:
                    outcome.morale_changes[f.id] = -10
                    f.morale = max(0, f.morale - 10)

        elif etype == "succession":
            if loser.role == "leader":
                loser.role = "exile"
                winner.role = "leader"
                for f in world.factions:
                    if f.id == winner.faction_id:
                        f.leader_id = winner.id

        outcome.character_effects = char_effects

        for ce in char_effects:
            for c in world.characters:
                if c.id == ce.char_id and isinstance(ce.value, (int, float)):
                    c.fitness = round(max(0, min(1, c.fitness + ce.value)), 3)

        event = Event(
            id=f"evt_{day:03d}_{i+1:02d}",
            day=day,
            type=etype,
            title=f"{etype.replace('_', ' ').title()}: {winner.name} vs {loser.name}",
            actors=[actor1.id, actor2.id],
            factions_involved=list(set(filter(None, [actor1.faction_id, actor2.faction_id]))),
            regions_affected=list(filter(None, [actor1.location or actor2.location])),
            outcome=outcome,
            narrative=""
        )
        events.append(event)

    # Chain reaction pass: check newly created events for consequent events
    chain_counter = 0
    chained = []
    for evt in list(events):  # iterate over a copy since we may append
        chain_counter += 1
        consequent = _maybe_chain_event(evt, world, day, chain_counter)
        if consequent:
            chained.append(consequent)
    events.extend(chained)

    # Deaths for low-fitness characters
    for c in alive_chars:
        if c.fitness < 0.15 and random.random() < 0.3:
            c.alive = False
            events.append(Event(
                id=f"evt_{day:03d}_death_{c.id}", day=day, type="death",
                title=f"{c.name} has fallen",
                actors=[c.id], factions_involved=[c.faction_id],
                regions_affected=[c.location], narrative=""
            ))

    # Crossover: top 2 fitness chars from same faction may produce successor
    for f in world.factions:
        faction_chars = sorted(
            [c for c in world.characters if c.faction_id == f.id and c.alive],
            key=lambda c: c.fitness, reverse=True
        )
        if len(faction_chars) >= 2 and random.random() < 0.15:
            p1, p2 = faction_chars[0], faction_chars[1]
            child_genome = Genome.crossover(p1.genome, p2.genome)
            child_id = f"char_{len(world.characters)+1:02d}"
            child = Character(
                id=child_id,
                name=f"Successor of {p1.name.split()[0]}",
                faction_id=f.id,
                role="protege",
                age=18,
                location=p1.location,
                backstory=f"Mentored by {p1.name} and {p2.name}",
                goals=["prove_worthy"],
                genome=child_genome,
                lineage=Lineage(parent_ids=[p1.id, p2.id], generation=max(p1.lineage.generation, p2.lineage.generation) + 1),
                fitness=0.5
            )
            world.characters.append(child)
            events.append(Event(
                id=f"evt_{day:03d}_birth_{child_id}", day=day, type="birth",
                title=f"{child.name} is born",
                actors=[p1.id, p2.id, child_id],
                factions_involved=[f.id],
                regions_affected=[p1.location] if p1.location else [],
                narrative=""
            ))

    # Snapshot faction state for power timeline
    for f in world.factions:
        world.faction_snapshots.append({
            "day": day,
            "faction_id": f.id,
            "territory_count": len(f.territory),
            "population": f.population,
            "morale": f.morale,
        })

    world.events.extend(events)
    save_world(world)
    return events
