import asyncio
from llm import chat_completion, extract_json
from prompts import geography, factions, characters
from prompts.prophecy import GENERATE_SYSTEM as PROPHECY_SYSTEM, generate_prophecies_prompt
from prompts.assembler import assemble_world
from models.world import World, Prophecy
from store import save_world

WORLD_NAME_SYSTEM = "You name fictional worlds. Respond with ONLY the name — 1-4 words, evocative and memorable. No quotes, no explanation."

async def generate_world(seed: str, num_regions: int = 6, num_factions: int = 4, num_characters: int = 15, on_progress=None) -> World:
    async def _notify(stage: str, detail: str = ""):
        if on_progress:
            await on_progress({"stage": stage, "detail": detail})

    await _notify("geography", "Generating terrain and regions...")
    geo_text = await chat_completion(geography.SYSTEM, geography.user_prompt(seed, num_regions), temperature=0.4)
    geo_data = extract_json(geo_text)
    await _notify("geography_done", f"{len(geo_data.get('regions', []))} regions created")

    await _notify("factions", "Generating factions...")
    faction_text = await chat_completion(factions.SYSTEM, factions.user_prompt(seed, geo_data.get("regions", []), num_factions), temperature=0.5)
    faction_data = extract_json(faction_text)
    await _notify("factions_done", f"{len(faction_data)} factions created")

    await _notify("characters", "Generating characters with genomes...")
    char_text = await chat_completion(characters.SYSTEM, characters.user_prompt(seed, faction_data, geo_data.get("regions", []), num_characters), temperature=0.8)
    char_data = extract_json(char_text)
    await _notify("characters_done", f"{len(char_data)} characters created")

    await _notify("assembling", "Assembling world...")
    world = assemble_world(seed, geo_data, faction_data, char_data)

    name = await chat_completion(WORLD_NAME_SYSTEM, f"Name this world: {seed}")
    world.name = name.strip().strip('"').strip("'")

    # Generate prophecies
    await _notify("prophecies", "The oracle speaks...")
    try:
        proph_raw = await chat_completion(PROPHECY_SYSTEM, generate_prophecies_prompt(
            world.name, world.seed,
            [r.model_dump() for r in world.geography.regions],
            [f.model_dump() for f in world.factions],
        ), max_tokens=1000)
        proph_data = extract_json(proph_raw)
        for i, p in enumerate(proph_data.get("prophecies", [])):
            world.prophecies.append(Prophecy(
                id=f"prophecy_{i}",
                text=p.get("text", ""),
                hint=p.get("hint", ""),
            ))
    except Exception:
        pass  # Prophecies are optional, don't fail world creation

    world.status = "ready"
    save_world(world)
    await _notify("complete", f"World '{world.name}' is alive")
    return world
