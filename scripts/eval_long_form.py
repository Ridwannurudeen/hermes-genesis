"""Long-form coherence eval — Hermes-4-70B vs Kimi-K2.6 head-to-head.

The grant pitch hinges on a real comparison artifact. This script:

  1. Picks a fixed seed list (or pulls all canonized articles from the wiki).
  2. Computes objective metrics on each article BODY (no LLM-as-judge — just
     deterministic textual measurements).
  3. Groups results by writer model (Hermes vs Kimi) and prints a comparison
     table + writes results.json + a Markdown summary.

Metrics (all heuristic, computable without LLM calls):

  fourth_wall_break_rate    fraction of articles containing "AI", "simulation",
                            "the reader", "this story", "fictional" — anything
                            that breaks the in-world voice.
  crosslink_density         mean [[slug]] crosslinks per 100 words.
  voice_register_match      regex pattern match for the article's declared voice
                            (court should have "Be it known", scripture should
                            have verse-numbered or archaic syntax, etc.).
  lexicon_adherence         when an era has a sample_lexicon, what fraction of
                            its terms appear in the article body. Higher = more
                            in-world flavor.
  word_count_target_ratio   actual word_count / target. Closer to 1.0 = better
                            length adherence.
  unique_token_ratio        unique tokens / total tokens. Higher = less
                            repetition / formulaic prose.

Usage:
    # Local (runs against the live API)
    python scripts/eval_long_form.py --base https://hermesgenesis.world --out docs/eval/

    # Or in-container (reads disk directly, faster + no rate-limit pressure)
    docker exec genesis-api python -m chroniclon.tools.eval_long_form
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Iterable


FOURTH_WALL_PATTERNS = [
    r"\bAI\b", r"\bartificial intelligence\b", r"\bsimulation\b", r"\bsimulated\b",
    r"\bthe reader\b", r"\bthis story\b", r"\bfictional\b", r"\bfiction\b",
    r"\b(in)? our (?:world|reality)\b", r"\bGPT\b", r"\bLLM\b", r"\bChat\w+\b",
    r"\b(?:author|writer)'s? note\b",
]


VOICE_REGEX = {
    "court":     re.compile(r"(?:be it known|by the grace of|her majesty|his majesty|seventh day of|reign of|the chancellery|the chronicler)", re.I),
    "scripture": re.compile(r"(?:and it came to pass|verily|thus saith|chapter \d+|verse \d+|stanza|psalm|in the beginning)", re.I),
    "diary":     re.compile(r"(?:^I |\bmy own hand\b|^Today\b|—\s*\d+(?:st|nd|rd|th) of|first-person|^Dear\b)", re.I | re.M),
    "newspaper": re.compile(r"(?:dispatch|reportedly|witnesses|sources say|filed from|by(?:line)?\s|—\s*[A-Z]{2,})", re.I),
    "scholarly": re.compile(r"(?:scholars|historians|the chroniclers|argued|attested|documented|the record shows)", re.I),
}


def fourth_wall_breaks(body: str) -> int:
    n = 0
    for pat in FOURTH_WALL_PATTERNS:
        n += len(re.findall(pat, body, re.IGNORECASE))
    return n


def crosslink_count(body: str) -> int:
    return len(re.findall(r"\[\[[a-z0-9\-]+\]\]", body))


def word_count(body: str) -> int:
    text = re.sub(r"`[^`]*`", " ", body)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    return len([w for w in re.split(r"\s+", text) if w.strip()])


def unique_token_ratio(body: str) -> float:
    tokens = re.findall(r"\b[a-zA-Z]{3,}\b", body.lower())
    if not tokens:
        return 0.0
    return len(set(tokens)) / len(tokens)


def voice_match(body: str, voice: str) -> bool:
    pat = VOICE_REGEX.get(voice)
    if pat is None:
        return False
    return bool(pat.search(body))


def lexicon_hits(body: str, lexicon: dict[str, str]) -> tuple[int, int]:
    if not lexicon:
        return 0, 0
    hits = 0
    body_lower = body.lower()
    for in_world in lexicon.values():
        if not in_world or len(in_world) < 2:
            continue
        if re.search(rf"\b{re.escape(in_world.lower())}\b", body_lower):
            hits += 1
    return hits, len(lexicon)


def fetch_json(url: str) -> dict | list:
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def writer_for(article: dict) -> str:
    """Infer the writer model from the article record. Articles in the live
    canon were written by Kimi (the runner default); regen articles were
    Kimi (post-fix) or Hermes (pre-fix). When the canon doesn't track the
    writer explicitly we attribute by recency rule: pre Apr 29 19:30 = Kimi,
    later regen-context articles vary. For now: assume Kimi for all
    canon-runner articles unless future versions persist a 'writer' field."""
    # If the article record gains a `writer` field in future versions we
    # honor it; otherwise default to kimi (the canon-runner writer).
    return article.get("writer") or article.get("written_by") or "kimi"


def collect(base: str, limit: int = 500) -> list[dict]:
    """Pull articles + lexicon from the live API."""
    art_index = fetch_json(f"{base}/api/chronicle/articles?limit={limit}")
    rows = art_index.get("items", [])
    out = []
    eras = {e["era_id"]: e for e in fetch_json(f"{base}/api/chronicle/eras").get("items", [])}
    lexicons = {le["era_id"]: le for le in fetch_json(f"{base}/api/chronicle/lexicon").get("items", [])}
    for r in rows:
        full = fetch_json(f"{base}/api/chronicle/articles/{r['slug']}")
        era = eras.get(r["era_id"], {})
        ling_id = era.get("linguistic_era")
        ling = lexicons.get(ling_id) if ling_id else None
        out.append({"summary": r, "full": full, "lexicon": (ling or {}).get("sample_lexicon", {})})
    return out


def measure(article: dict) -> dict:
    body = article["full"].get("body_md", "")
    voice = article["full"].get("voice", "scholarly")
    target = article["full"].get("word_count", 0) or 1
    actual = word_count(body) or 1
    lex_hits, lex_size = lexicon_hits(body, article["lexicon"])
    return {
        "writer": writer_for(article["full"]),
        "voice": voice,
        "kind": article["full"].get("kind", "event"),
        "fourth_wall_breaks": fourth_wall_breaks(body),
        "crosslink_density_per_100w": round(100.0 * crosslink_count(body) / actual, 3),
        "voice_register_match": voice_match(body, voice),
        "lexicon_hits": lex_hits,
        "lexicon_size": lex_size,
        "lexicon_adherence": round(lex_hits / lex_size, 3) if lex_size else None,
        "word_count": actual,
        "unique_token_ratio": round(unique_token_ratio(body), 3),
        "anti_slop_score": article["full"].get("anti_slop_score"),
        "fact_check_score": article["full"].get("fact_check_score"),
    }


def aggregate(rows: list[dict]) -> dict:
    by_writer: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_writer[r["writer"]].append(r)
    summary = {}
    for writer, batch in by_writer.items():
        n = len(batch)
        if n == 0:
            continue
        summary[writer] = {
            "n_articles": n,
            "fourth_wall_break_rate": round(sum(1 for r in batch if r["fourth_wall_breaks"] > 0) / n, 3),
            "fourth_wall_breaks_per_article": round(statistics.mean(r["fourth_wall_breaks"] for r in batch), 3),
            "crosslink_density_per_100w": round(statistics.mean(r["crosslink_density_per_100w"] for r in batch), 3),
            "voice_register_match_rate": round(sum(1 for r in batch if r["voice_register_match"]) / n, 3),
            "lexicon_adherence_mean": round(statistics.mean(r["lexicon_adherence"] for r in batch if r["lexicon_adherence"] is not None) or 0, 3) if any(r["lexicon_adherence"] is not None for r in batch) else None,
            "unique_token_ratio_mean": round(statistics.mean(r["unique_token_ratio"] for r in batch), 3),
            "word_count_mean": round(statistics.mean(r["word_count"] for r in batch), 1),
            "anti_slop_mean": round(statistics.mean(r["anti_slop_score"] for r in batch if r["anti_slop_score"] is not None) or 0, 3) if any(r["anti_slop_score"] is not None for r in batch) else None,
            "fact_check_mean": round(statistics.mean(r["fact_check_score"] for r in batch if r["fact_check_score"] is not None) or 0, 3) if any(r["fact_check_score"] is not None for r in batch) else None,
            "voice_distribution": dict(Counter(r["voice"] for r in batch)),
        }
    return summary


def write_markdown(summary: dict, out: Path, n_total: int) -> None:
    lines = [
        "# Long-form coherence — Chroniclon canon eval",
        "",
        f"_Generated_: {datetime.utcnow().isoformat()}Z",
        f"_Articles measured_: {n_total}",
        "",
        "## Methodology",
        "",
        "All metrics are deterministic textual measurements — no LLM-as-judge,",
        "no human grading. The grant question is whether long-form coherence",
        "differs across writers (Hermes-4-70B vs Kimi-K2.6) on the same",
        "agentic pipeline.",
        "",
        "| Metric | What it measures |",
        "|---|---|",
        "| fourth_wall_break_rate | fraction of articles mentioning AI/simulation/etc. |",
        "| crosslink_density_per_100w | `[[slug]]` references per 100 words |",
        "| voice_register_match_rate | regex match against the declared voice (court/scripture/diary/newspaper/scholarly) |",
        "| lexicon_adherence | fraction of the era's sample lexicon that appears in the body |",
        "| unique_token_ratio | unique 3+ char alpha tokens / total. Repetition canary. |",
        "| word_count_mean | actual prose length |",
        "",
        "## Results",
        "",
    ]
    for writer, s in summary.items():
        lines.append(f"### {writer}")
        lines.append("")
        for k, v in s.items():
            lines.append(f"- **{k}**: `{v}`")
        lines.append("")
    out.write_text("\n".join(lines), encoding="utf-8")


def run(base: str, out_dir: Path, limit: int = 500) -> None:
    articles = collect(base, limit=limit)
    rows = [measure(a) for a in articles]
    summary = aggregate(rows)
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "results.json").write_text(json.dumps({"per_article": rows, "summary": summary}, indent=2), encoding="utf-8")
    write_markdown(summary, out_dir / "summary.md", n_total=len(rows))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="https://hermesgenesis.world", help="API base URL")
    p.add_argument("--out", default="docs/eval", help="Output directory")
    p.add_argument("--limit", type=int, default=500, help="Max articles to process")
    args = p.parse_args()
    out = Path(args.out)
    if not out.is_absolute():
        out = Path(__file__).parent.parent / out
    run(args.base, out, limit=args.limit)
