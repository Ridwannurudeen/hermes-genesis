"""Render a wiki article to a single TTS chapter (mp3).

Usage:
    python -m chroniclon.audio_chapter --slug the-betrayal-of-silas-stargaze

Reads the article, strips markdown, synthesises via voices.py (OpenAI TTS or
ElevenLabs depending on TTS_PROVIDER), saves to data/chroniclon/audio/<slug>.mp3,
updates the article's audio_url field. Idempotent — re-running overwrites.

Cost note: OpenAI tts-1 is ~$15 per 1M chars. A typical 600-word article is
~3.5k chars ≈ $0.05 per chapter. Stays well inside the $10 budget envelope.
"""
import argparse
import asyncio
import logging
import re
import sys
from pathlib import Path

from config import CHRONICLON_DIR
from chroniclon import store
from chroniclon.voices import is_configured, synthesize, voice_archetype_from_genome

logger = logging.getLogger("chroniclon.audio_chapter")

# OpenAI TTS hard cap is 4096 chars per request. Keep some headroom.
MAX_TTS_CHARS = 3800


def strip_markdown(md: str) -> str:
    """Convert article markdown to TTS-friendly plain text."""
    text = md
    # Drop crosslinks: [[slug-name]] → "slug name"
    text = re.sub(r"\[\[([a-z0-9\-]+)\]\]", lambda m: m.group(1).replace("-", " "), text)
    # Drop bold/italic: **x** *x*
    text = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", text)
    # Drop inline code
    text = re.sub(r"`[^`]+`", "", text)
    # Drop headers but keep the title text (replace # with nothing)
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.MULTILINE)
    # Drop blockquote markers
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    # Collapse multiple newlines into paragraph breaks (TTS pause)
    text = re.sub(r"\n{2,}", ". ", text)
    text = re.sub(r"\n+", " ", text)
    # Collapse multiple spaces
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def truncate_to_limit(text: str, limit: int = MAX_TTS_CHARS) -> str:
    """Truncate at the last sentence boundary under the limit."""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    # Find last sentence-ending punctuation
    last_period = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    if last_period > limit * 0.6:
        return cut[: last_period + 1]
    return cut


async def render_chapter(slug: str) -> dict:
    if not is_configured():
        raise SystemExit("TTS not configured — set TTS_PROVIDER and the matching API key in .env")

    article = store.load_article_by_slug(slug)
    if article is None:
        raise SystemExit(f"article not found: {slug}")

    plain = strip_markdown(article.body_md)
    plain = truncate_to_limit(plain)
    logger.info(f"rendering {slug}: {len(plain)} chars to TTS")

    archetype = "narrator"
    # Future: pick archetype based on the article's lead character genome
    target = Path(CHRONICLON_DIR) / "audio" / f"{slug}.mp3"
    output_path = await synthesize(plain, archetype=archetype, output_path=target)
    logger.info(f"wrote audio: {output_path}")

    # Update the article's audio_url
    article.audio_url = f"/api/chronicle/audio/{article.slug}"
    store.save_article(article)

    return {
        "slug": slug,
        "audio_path": str(output_path),
        "char_count": len(plain),
        "audio_url": article.audio_url,
    }


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s", stream=sys.stdout)
    parser = argparse.ArgumentParser(description="Render a wiki article to TTS audio.")
    parser.add_argument("--slug", required=True, help="article slug")
    args = parser.parse_args()
    result = asyncio.run(render_chapter(args.slug))
    print(f"\nDONE: {result['slug']}\n  chars: {result['char_count']}\n  url:   {result['audio_url']}\n  file:  {result['audio_path']}")


if __name__ == "__main__":
    main()
