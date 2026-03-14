import random
from models.world import World
from models.event import Event, EventOutcome, CharacterEffect
from models.character import Character, Lineage, Relationship
from models.genome import Genome, TRAITS
from store import save_world

# Name generation for offspring — avoids "Successor of Successor" degradation
_NAME_PREFIXES = [
    "Ash", "Bel", "Cor", "Dra", "El", "Fen", "Gor", "Hal", "Ir", "Jas",
    "Kel", "Lor", "Mor", "Ner", "Or", "Pyr", "Ral", "Sar", "Tor", "Val",
    "Wren", "Xan", "Yar", "Zan", "Bri", "Cal", "Dyn", "Eri", "Fal", "Gwyn",
    "Hel", "Ith", "Jyn", "Kael", "Lys", "Myr", "Nyx", "Orin", "Pax", "Ryn",
    "Syl", "Thal", "Ula", "Vex", "Wyl", "Zeph", "Ara", "Bane", "Cael", "Dar",
]
_NAME_SUFFIXES = [
    "ric", "wen", "thor", "ia", "ius", "aine", "on", "iel", "ara", "is",
    "oth", "ane", "rin", "ek", "as", "ora", "iel", "yn", "ax", "us",
    "ina", "eld", "orn", "ith", "al", "en", "ir", "os", "une", "yx",
]

def _generate_child_name(parent1_name: str, parent2_name: str, existing_names: set[str]) -> str:
    """Generate a unique fantasy name blending parent name fragments."""
    # Try blending parent names first (take start of one, end of another)
    p1_first = parent1_name.split()[0] if parent1_name else "Unknown"
    p2_first = parent2_name.split()[0] if parent2_name else "Unknown"

    # Strategy 1: First syllable(s) of parent1 + suffix from parent2
    candidates = []
    p1_root = p1_first[:max(2, len(p1_first)//2)]
    p2_end = p2_first[max(1, len(p2_first)//2):]
    blended = p1_root + p2_end.lower()
    if len(blended) >= 3:
        candidates.append(blended.capitalize())

    # Strategy 2: Reverse blend
    p2_root = p2_first[:max(2, len(p2_first)//2)]
    p1_end = p1_first[max(1, len(p1_first)//2):]
    blended2 = p2_root + p1_end.lower()
    if len(blended2) >= 3:
        candidates.append(blended2.capitalize())

    # Strategy 3: Random prefix + suffix
    for _ in range(5):
        name = random.choice(_NAME_PREFIXES) + random.choice(_NAME_SUFFIXES)
        candidates.append(name)

    # Pick first candidate not already in use
    for name in candidates:
        if name not in existing_names:
            return name

    # Fallback: prefix + random number suffix
    return random.choice(_NAME_PREFIXES) + random.choice(_NAME_SUFFIXES) + str(random.randint(2, 99))

def repair_leadership(world: World, dead_char_id: str) -> None:
    """If the dead character was a faction leader, promote the highest-fitness alive member."""
    for f in world.factions:
        if f.leader_id == dead_char_id:
            alive_members = sorted(
                [c for c in world.characters if c.faction_id == f.id and c.alive],
                key=lambda c: c.fitness, reverse=True,
            )
            if alive_members:
                new_leader = alive_members[0]
                new_leader.role = "leader"
                f.leader_id = new_leader.id
            else:
                f.leader_id = ""
            break


def _update_relationships(world: World, event: Event, winner_id: str | None, loser_id: str | None):
    """Mutate character relationships based on event outcomes."""
    if not winner_id or not loser_id:
        return

    winner = next((c for c in world.characters if c.id == winner_id), None)
    loser = next((c for c in world.characters if c.id == loser_id), None)
    if not winner or not loser:
        return

    etype = event.type
    rel_updates: list[tuple[Character, str, str, float]] = []  # (char, target_id, type, intensity)

    if etype == "military_conflict":
        rel_updates.append((winner, loser.id, "rival", 0.7))
        rel_updates.append((loser, winner.id, "enemy", 0.8))
    elif etype == "betrayal":
        rel_updates.append((winner, loser.id, "enemy", 0.9))
        rel_updates.append((loser, winner.id, "enemy", 0.95))
    elif etype == "alliance":
        rel_updates.append((winner, loser.id, "ally", 0.7))
        rel_updates.append((loser, winner.id, "ally", 0.7))
    elif etype == "succession":
        rel_updates.append((winner, loser.id, "rival", 0.6))
        rel_updates.append((loser, winner.id, "enemy", 0.75))
    elif etype == "political_intrigue":
        rel_updates.append((winner, loser.id, "rival", 0.5))
        rel_updates.append((loser, winner.id, "rival", 0.6))

    for char, target_id, rel_type, intensity in rel_updates:
        existing = next((r for r in char.relationships if r.target_id == target_id), None)
        if existing:
            existing.type = rel_type
            existing.intensity = min(1.0, max(existing.intensity, intensity))
        else:
            char.relationships.append(Relationship(target_id=target_id, type=rel_type, intensity=intensity))


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

        # Apply real world mutations based on chain type
        outcome = EventOutcome()
        char_effects = []

        if chain_type == "military_conflict":
            # Territory transfer: loser's faction loses a region to winner's faction
            loser_faction = next((f for f in world.factions if f.id == loser.faction_id), None)
            winner_faction = next((f for f in world.factions if f.id == winner.faction_id), None)
            if loser_faction and winner_faction and loser_faction.territory:
                taken_region = random.choice(loser_faction.territory)
                loser_faction.territory.remove(taken_region)
                if taken_region not in winner_faction.territory:
                    winner_faction.territory.append(taken_region)
                for r in world.geography.regions:
                    if r.id == taken_region:
                        r.controlled_by = winner_faction.id
                outcome.territory_changes = {taken_region: winner_faction.id}
            # Fitness impact
            winner.fitness = min(1.0, winner.fitness + 0.08)
            loser.fitness = max(0.0, loser.fitness - 0.10)
            char_effects.append(CharacterEffect(char_id=winner.id, effect="fitness", value=0.08))
            char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness", value=-0.10))
            # Morale impact
            if loser_faction:
                loser_faction.morale = max(0, loser_faction.morale - 8)
                outcome.morale_changes = {loser_faction.id: -8}

        elif chain_type == "succession":
            # Only fire succession within same faction
            if winner.faction_id == loser.faction_id:
                winner.role = "leader"
                loser.role = "former_leader"
                faction = next((f for f in world.factions if f.id == winner.faction_id), None)
                if faction:
                    faction.leader_id = winner.id
                    faction.morale = min(100, faction.morale + 5)
                    outcome.morale_changes = {faction.id: 5}
            else:
                # Cross-faction: just a political rivalry, no leadership change
                loser.role = "disgraced"
            winner.fitness = min(1.0, winner.fitness + 0.12)
            loser.fitness = max(0.0, loser.fitness - 0.08)
            char_effects.append(CharacterEffect(char_id=winner.id, effect="fitness", value=0.12))
            char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness", value=-0.08))

        elif chain_type == "political_intrigue":
            # Morale and fitness impact
            loser.fitness = max(0.0, loser.fitness - 0.06)
            winner.fitness = min(1.0, winner.fitness + 0.05)
            char_effects.append(CharacterEffect(char_id=winner.id, effect="fitness", value=0.05))
            char_effects.append(CharacterEffect(char_id=loser.id, effect="fitness", value=-0.06))
            loser_faction = next((f for f in world.factions if f.id == loser.faction_id), None)
            if loser_faction:
                loser_faction.morale = max(0, loser_faction.morale - 5)
                outcome.morale_changes = {loser_faction.id: -5}

        elif chain_type == "cultural_shift":
            # Alliance formation and morale boost for both
            f1 = next((f for f in world.factions if f.id == actor1.faction_id), None)
            f2 = next((f for f in world.factions if f.id == actor2.faction_id), None)
            if f1 and f2 and f1.id != f2.id:
                if f2.id not in f1.alliances:
                    f1.alliances.append(f2.id)
                if f1.id not in f2.alliances:
                    f2.alliances.append(f1.id)
                f1.morale = min(100, f1.morale + 3)
                f2.morale = min(100, f2.morale + 3)
                outcome.morale_changes = {f1.id: 3, f2.id: 3}

        outcome.character_effects = char_effects

        chain_event = Event(
            id=f"evt_{day:03d}_chain_{event_counter:02d}",
            day=day,
            type=chain_type,
            title=f"{chain_type.replace('_', ' ').title()}: {winner.name} vs {loser.name} (consequence)",
            actors=[actor1.id, actor2.id],
            factions_involved=list(set(filter(None, [actor1.faction_id, actor2.faction_id]))),
            regions_affected=list(filter(None, [actor1.location or actor2.location])),
            outcome=outcome,
            narrative="",
            caused_by=parent.id,
        )
        _update_relationships(world, chain_event, winner_id, loser_id)
        return chain_event

    return None


def simulate_tick(world: World) -> list[Event]:
    world.current_day += 1
    day = world.current_day
    events = []
    alive_chars = [c for c in world.characters if c.alive]
    if len(alive_chars) < 2:
        return events

    max_events = max(1, min(5, len(alive_chars) // 4))
    num_events = random.randint(1, max(1, max_events))
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
            if loser.role == "leader" and loser.faction_id == winner.faction_id:
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
        _update_relationships(world, event, winner_id, loser_id)

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
            repair_leadership(world, c.id)
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
            existing_names = {c.name for c in world.characters}
            child_name = _generate_child_name(p1.name, p2.name, existing_names)
            # Add a surname from parent if they have one
            p1_parts = p1.name.split()
            if len(p1_parts) > 1:
                child_name = f"{child_name} {p1_parts[-1]}"
            child = Character(
                id=child_id,
                name=child_name,
                faction_id=f.id,
                role="protege",
                age=18,
                location=p1.location,
                backstory=f"Born of {p1.name} and {p2.name}, raised in the traditions of the {f.name}",
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

    # Sync faction population from actual alive character counts
    for f in world.factions:
        f.population = sum(1 for c in world.characters if c.faction_id == f.id and c.alive)

    # Snapshot faction state for power timeline (cap at 500 entries)
    for f in world.factions:
        world.faction_snapshots.append({
            "day": day,
            "faction_id": f.id,
            "territory_count": len(f.territory),
            "population": f.population,
            "morale": f.morale,
        })
    if len(world.faction_snapshots) > 500:
        world.faction_snapshots = world.faction_snapshots[-500:]

    world.events.extend(events)
    save_world(world)
    return events
