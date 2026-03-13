SYSTEM = """You are a veteran tabletop RPG game designer creating campaign materials.
Convert fantasy world data into ready-to-play TTRPG campaign content.
Write in a clear, practical style that a Game Master can use directly at the table.
Include specific stats, plot hooks, and encounter suggestions."""


def campaign_kit_prompt(world_name: str, seed: str, current_day: int,
                        regions: list, factions: list, characters: list,
                        events: list, prophecies: list) -> str:
    # Build comprehensive world context
    region_text = ""
    for r in regions:
        pois = ", ".join([p.get("name", "") for p in r.get("points_of_interest", [])]) or "none"
        region_text += f"\n### {r.get('name', '?')} ({r.get('type', '?')})\n"
        region_text += f"Climate: {r.get('climate', '?')}, Resources: {', '.join(r.get('resources', []))}\n"
        region_text += f"Controlled by: {r.get('controlled_by', 'contested')}\n"
        region_text += f"Points of Interest: {pois}\n"

    faction_text = ""
    for f in factions:
        faction_text += f"\n### {f.get('name', '?')}\n"
        faction_text += f"Ideology: {f.get('ideology', '?')}\n"
        faction_text += f"Territory: {len(f.get('territory', []))} regions, Population: {f.get('population', '?')}, Morale: {f.get('morale', '?')}\n"
        faction_text += f"Allies: {', '.join(f.get('alliances', [])) or 'none'}\n"
        faction_text += f"Enemies: {', '.join(f.get('enemies', [])) or 'none'}\n"
        faction_text += f"Traits: {', '.join(f.get('traits', []))}\n"

    alive = [c for c in characters if c.get("alive", True)]
    dead = [c for c in characters if not c.get("alive", True)]

    char_text = ""
    for c in alive[:20]:
        genome = c.get("genome", {})
        char_text += f"\n### {c.get('name', '?')} ({c.get('role', '?')})\n"
        char_text += f"Faction: {c.get('faction_id', '?')}, Age: {c.get('age', '?')}, Location: {c.get('location', '?')}\n"
        char_text += f"Backstory: {c.get('backstory', '')}\n"
        char_text += f"Goals: {', '.join(c.get('goals', []))}\n"
        char_text += f"Traits: STR(courage)={genome.get('courage', 0.5):.1f} DEX(cunning)={genome.get('cunning', 0.5):.1f} CON(resilience)={genome.get('resilience', 0.5):.1f} WIS(empathy)={genome.get('empathy', 0.5):.1f} INT(ambition)={genome.get('ambition', 0.5):.1f} CHA(loyalty)={genome.get('loyalty', 0.5):.1f}\n"

    event_text = ""
    for e in events[-30:]:
        event_text += f"- Day {e.get('day', '?')}: [{e.get('type', '?')}] {e.get('title', '')} — {e.get('narrative', e.get('description', ''))[:150]}\n"

    prophecy_text = ""
    for p in prophecies:
        status = "FULFILLED" if p.get("fulfilled") else "ACTIVE"
        prophecy_text += f"- [{status}] {p.get('text', '')}\n"

    return f"""Create a complete TTRPG Campaign Kit for this world.

WORLD: "{world_name}"
PREMISE: "{seed}"
CURRENT DAY: {current_day}

REGIONS:{region_text}

FACTIONS:{faction_text}

CHARACTERS (NPCs):{char_text}

FALLEN HEROES: {', '.join([c.get('name', '?') for c in dead[:10]]) or 'None yet'}

HISTORY:{event_text}

PROPHECIES:
{prophecy_text or 'None'}

Generate a complete campaign kit with these sections:
1. **World Overview** — 2-3 paragraph setting description for players
2. **Faction Briefings** — For each faction: description, goals, potential quests, attitude toward players
3. **Key NPC Profiles** — For top 8 NPCs: personality, motivations, how they interact with players, secret agenda
4. **Plot Hooks** — 8-10 adventure hooks derived from world events and tensions
5. **Regional Encounter Guide** — For each region: atmosphere, hazards, 3 encounter ideas
6. **Active Prophecies** — Each prophecy with GM notes on how to weave it into play
7. **Session Zero Notes** — Suggested campaign themes, player faction choices, starting location recommendations

Format as clean markdown. Be specific and practical — a GM should be able to run a session directly from this."""
