"""AI scene image generation for cinematic mode using Together AI FLUX."""

import os
import base64
import hashlib
import httpx
from config import IMAGE_API_KEY, IMAGE_API_URL, IMAGE_MODEL

# Scene prompt templates per event type
SCENE_PROMPTS: dict[str, str] = {
    "military_conflict": "Epic fantasy battle scene, two armies clashing on a vast battlefield, dramatic stormy sky, fire and smoke, medieval warriors with banners, cinematic wide shot, dark fantasy art style, highly detailed",
    "betrayal": "Dark medieval throne room, shadowy figure holding a dagger behind their back, candlelight casting long shadows, treachery and deception, dramatic chiaroscuro lighting, dark fantasy painting",
    "alliance": "Two medieval leaders meeting under a grand pavilion, golden sunlight streaming through, banners of two kingdoms united, handshake of peace, hopeful atmosphere, fantasy art, warm tones",
    "succession": "Grand coronation ceremony in a cathedral, golden crown being placed on a new ruler, gathered nobles watching, shafts of light from stained glass windows, regal and solemn, fantasy art",
    "political_intrigue": "Dimly lit medieval council chamber, hooded figures whispering around a table with maps, candles flickering, conspiratorial atmosphere, shadows and secrets, dark fantasy painting",
    "cultural_shift": "Medieval festival in a bustling city square, changing banners and symbols, people celebrating, colorful market stalls, cultural transformation, vibrant fantasy art",
    "natural_disaster": "Catastrophic natural disaster in a fantasy kingdom, volcanic eruption or great storm, people fleeing, dramatic dark clouds and lightning, destruction of a medieval city, epic fantasy art",
    "death": "Somber medieval funeral scene, torch-lit procession through misty ruins, mourning figures in dark robes, fallen warrior on a pyre, melancholic atmosphere, dark fantasy painting",
    "birth": "Dawn breaking over a medieval castle, golden light flooding through windows, new beginning, a bright star in the sky, hope and renewal, warm ethereal fantasy art",
    "divine_intervention": "Massive beam of divine light breaking through storm clouds onto a medieval battlefield, angelic or godly presence, mortals looking up in awe, epic divine fantasy scene",
    "discovery": "Explorer discovering ancient ruins in a mystical forest, glowing artifacts, overgrown temple entrance, rays of light illuminating forgotten treasures, adventure fantasy art",
    "agent_intervention": "Mystical oracle chamber with a glowing crystal orb, arcane symbols floating in the air, a robed figure channeling cosmic energy, ethereal blue and purple lights, fantasy art",
    "prophecy_fulfilled": "Ancient prophecy scroll unrolling with glowing text, dramatic sky with celestial alignment, fulfilled destiny, magical energy radiating outward, epic mystical fantasy scene",
    "economic_boom": "Prosperous medieval trading port, ships with full sails, bustling marketplace overflowing with goods, golden hour sunlight, wealth and abundance, detailed fantasy art",
    "migration": "Great caravan of people journeying across vast fantasy landscape, wagons and travelers on a winding road through mountains, epic journey, cinematic wide shot, fantasy art",
    "espionage": "Spy climbing castle walls at night, moonlit medieval fortress, dark figure in shadow, tension and stealth, cold blue tones, noir fantasy art",
    "religious_event": "Grand temple ceremony with mystical rituals, priests channeling divine energy, ethereal light, sacred symbols glowing, congregation in awe, fantasy religious art",
}

DEFAULT_PROMPT = "Dramatic fantasy landscape scene, medieval world, cinematic lighting, epic atmosphere, detailed fantasy art painting"

# Cache directory for generated images
CACHE_DIR = os.path.join(os.path.dirname(__file__), "data", "scene_cache")


def _ensure_cache_dir() -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)


def _cache_key(event_type: str, title: str) -> str:
    """Generate a cache key from event type and title."""
    raw = f"{event_type}:{title}".lower().strip()
    return hashlib.md5(raw.encode()).hexdigest()


def _cached_path(key: str) -> str:
    return os.path.join(CACHE_DIR, f"{key}.webp")


def get_cached_image(event_type: str, title: str) -> str | None:
    """Return base64-encoded cached image if it exists."""
    _ensure_cache_dir()
    path = _cached_path(_cache_key(event_type, title))
    if os.path.isfile(path):
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode()
    return None


def _build_prompt(event_type: str, title: str) -> str:
    """Build a scene prompt from event type and title context."""
    base = SCENE_PROMPTS.get(event_type, DEFAULT_PROMPT)
    # Incorporate the event title for uniqueness
    return f"{base}. Scene context: {title}. No text, no words, no letters, no watermarks."


async def generate_scene_image(event_type: str, title: str) -> str | None:
    """Generate a scene image using Together AI FLUX.

    Returns base64-encoded image data or None on failure.
    """
    if not IMAGE_API_KEY:
        return None

    # Check cache first
    cached = get_cached_image(event_type, title)
    if cached:
        return cached

    prompt = _build_prompt(event_type, title)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{IMAGE_API_URL}/images/generations",
                headers={
                    "Authorization": f"Bearer {IMAGE_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": IMAGE_MODEL,
                    "prompt": prompt,
                    "width": 1440,
                    "height": 816,
                    "steps": 8,
                    "n": 1,
                    "response_format": "b64_json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            b64_data = data["data"][0]["b64_json"]

            # Cache the image
            _ensure_cache_dir()
            key = _cache_key(event_type, title)
            img_bytes = base64.b64decode(b64_data)
            with open(_cached_path(key), "wb") as f:
                f.write(img_bytes)

            return b64_data

    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to generate scene: %s", e)
        return None
