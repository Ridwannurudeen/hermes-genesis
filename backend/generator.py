import asyncio
from llm import chat_completion, extract_json
from prompts import geography, factions, characters
from prompts.prophecy import GENERATE_SYSTEM as PROPHECY_SYSTEM, generate_prophecies_prompt
from prompts.assembler import assemble_world
from models.world import World, Prophecy
from store import save_world

WORLD_NAME_SYSTEM = "You name fictional worlds. Respond with ONLY the name — 1-4 words, evocative and memorable. No quotes, no explanation."

async def generate_world(seed: str, num_regions: int = 4, num_factions: int = 3, num_characters: int = 8, on_progress=None) -> World:
    async def _notify(stage: str, detail: str = ""):
        if on_progress:
            await on_progress({"stage": stage, "detail": detail})

    await _notify("geography", "Generating terrain and regions...")
    geo_text = await chat_completion(geography.SYSTEM, geography.user_prompt(seed, num_regions), temperature=0.4, max_tokens=1500)
    geo_data = extract_json(geo_text)
    await _notify("geography_done", f"{len(geo_data.get('regions', []))} regions created")

    await _notify("factions", "Generating factions...")
    faction_text = await chat_completion(factions.SYSTEM, factions.user_prompt(seed, geo_data.get("regions", []), num_factions), temperature=0.5, max_tokens=1500)
    faction_data = extract_json(faction_text)
    await _notify("factions_done", f"{len(faction_data)} factions created")

    # Generate characters + world name in parallel (name doesn't depend on characters)
    await _notify("characters", "Generating characters with genomes...")

    async def _gen_name():
        raw = await chat_completion(WORLD_NAME_SYSTEM, f"Name this world: {seed}", max_tokens=50)
        return raw.strip().strip('"').strip("'")

    char_text, name = await asyncio.gather(
        chat_completion(characters.SYSTEM, characters.user_prompt(seed, faction_data, geo_data.get("regions", []), num_characters), temperature=0.8, max_tokens=3500),
        _gen_name(),
    )
    char_data = extract_json(char_text)
    await _notify("characters_done", f"{len(char_data)} characters created")

    await _notify("assembling", "Assembling world...")
    world = assemble_world(seed, geo_data, faction_data, char_data)
    world.name = name

    # Generate prophecies
    await _notify("prophecies", "The oracle speaks...")

    async def _gen_prophecies():
        try:
            proph_raw = await chat_completion(PROPHECY_SYSTEM, generate_prophecies_prompt(
                seed, name,
                [r.model_dump() for r in world.geography.regions],
                [f.model_dump() for f in world.factions],
            ), max_tokens=800)
            return extract_json(proph_raw)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Prophecy generation failed: %s", e)
            return {}

    proph_data = await _gen_prophecies()

    for i, p in enumerate(proph_data.get("prophecies", [])):
        world.prophecies.append(Prophecy(
            id=f"prophecy_{i}",
            text=p.get("text", ""),
            hint=p.get("hint", ""),
        ))

    world.status = "ready"
    save_world(world)
    await _notify("complete", f"World '{world.name}' is alive")
    return world
