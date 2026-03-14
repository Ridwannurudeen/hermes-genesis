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
    char_text = await chat_completion(characters.SYSTEM, characters.user_prompt(seed, faction_data, geo_data.get("regions", []), num_characters), temperature=0.8, max_tokens=6000)
    char_data = extract_json(char_text)
    await _notify("characters_done", f"{len(char_data)} characters created")

    await _notify("assembling", "Assembling world...")
    world = assemble_world(seed, geo_data, faction_data, char_data)

    # Generate world name + prophecies in parallel (prophecy uses seed/regions/factions, not name)
    await _notify("prophecies", "The oracle speaks...")

    async def _gen_name():
        raw = await chat_completion(WORLD_NAME_SYSTEM, f"Name this world: {seed}")
        return raw.strip().strip('"').strip("'")

    async def _gen_prophecies():
        try:
            proph_raw = await chat_completion(PROPHECY_SYSTEM, generate_prophecies_prompt(
                seed, seed,  # use seed as placeholder — name isn't critical for prophecy quality
                [r.model_dump() for r in world.geography.regions],
                [f.model_dump() for f in world.factions],
            ), max_tokens=1000)
            return extract_json(proph_raw)
        except Exception:
            return {}

    name, proph_data = await asyncio.gather(_gen_name(), _gen_prophecies())
    world.name = name

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
