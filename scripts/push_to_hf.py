"""Pack the Chroniclon canon as a HuggingFace dataset and (optionally) push.

Two output modes:

  --pack-only     Build a local JSONL + asset bundle under ./hf_dataset/.
                  No network / no auth needed. Inspect, then push later.

  --push          Upload to huggingface.co/datasets/<repo>. Requires HF_TOKEN
                  in env or a logged-in `huggingface-cli login`.

The dataset card is generated automatically with metric summaries pulled
from scripts/eval_long_form.py output (if present at docs/eval/).

Schema (one row per article):

  article_id          str
  slug                str
  title               str
  kind                str            event|person|faction|place|...
  voice               str            scholarly|diary|newspaper|scripture|court
  era_id              str
  era_name            str
  era_art_style       str
  in_world_year       int
  body_md             str
  word_count          int
  backlinks           list[str]
  inbound             list[str]
  anti_slop_score     float|null
  fact_check_score    float|null
  critic_passes       int
  illustration_path   str|null       relative path under images/ in the bundle
  audio_path          str|null       relative path under audio/ in the bundle
  contributor         str|null       null = autonomous, "@handle" = audience-submitted
  created_at          str            iso8601
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DEFAULT_OUT = REPO_ROOT / "hf_dataset"
DEFAULT_DATA = REPO_ROOT / "data" / "chroniclon"


def collect_articles(data_dir: Path) -> list[dict]:
    art_dir = data_dir / "articles"
    if not art_dir.exists():
        raise SystemExit(f"articles dir not found: {art_dir}")
    out: list[dict] = []
    for f in sorted(art_dir.glob("*.json")):
        if f.name.startswith("."):
            continue
        try:
            out.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception as ex:
            print(f"WARN: skipped {f}: {ex}", file=sys.stderr)
    return out


def collect_eras(data_dir: Path) -> dict[str, dict]:
    era_dir = data_dir / "eras"
    if not era_dir.exists():
        return {}
    out: dict[str, dict] = {}
    for f in era_dir.glob("*.json"):
        if f.name.startswith("."):
            continue
        try:
            era = json.loads(f.read_text(encoding="utf-8"))
            out[era["era_id"]] = era
        except Exception:
            continue
    return out


def pack(data_dir: Path, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    images_out = out_dir / "images"
    audio_out = out_dir / "audio"
    images_out.mkdir(exist_ok=True)
    audio_out.mkdir(exist_ok=True)

    articles = collect_articles(data_dir)
    eras = collect_eras(data_dir)
    src_images = data_dir / "images"
    src_audio = data_dir / "audio"

    rows: list[dict] = []
    n_with_image = n_with_audio = 0
    for a in articles:
        slug = a["slug"]
        era = eras.get(a["era_id"], {})

        ill_src = src_images / f"{slug}.webp"
        aud_src = src_audio / f"{slug}.mp3"
        ill_rel = aud_rel = None
        if ill_src.exists():
            shutil.copy2(ill_src, images_out / ill_src.name)
            ill_rel = f"images/{ill_src.name}"
            n_with_image += 1
        if aud_src.exists():
            shutil.copy2(aud_src, audio_out / aud_src.name)
            aud_rel = f"audio/{aud_src.name}"
            n_with_audio += 1

        rows.append({
            "article_id": a["article_id"],
            "slug": slug,
            "title": a["title"],
            "kind": a["kind"],
            "voice": a.get("voice", "scholarly"),
            "era_id": a["era_id"],
            "era_name": era.get("name", ""),
            "era_art_style": era.get("art_style", ""),
            "in_world_year": a.get("in_world_year", 0),
            "body_md": a.get("body_md", ""),
            "word_count": a.get("word_count", 0),
            "backlinks": a.get("backlinks", []),
            "inbound": a.get("inbound", []),
            "anti_slop_score": a.get("anti_slop_score"),
            "fact_check_score": a.get("fact_check_score"),
            "critic_passes": a.get("critic_passes", 0),
            "illustration_path": ill_rel,
            "audio_path": aud_rel,
            "contributor": a.get("contributor"),
            "created_at": a.get("created_at"),
            "updated_at": a.get("updated_at"),
        })

    # JSONL
    jsonl_path = out_dir / "canon.jsonl"
    with jsonl_path.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    # Splits — keep it simple: full canon in 'train', no test split (the
    # whole corpus is the artifact). Dataset consumers can resplit.
    return {
        "n_articles": len(rows),
        "n_with_image": n_with_image,
        "n_with_audio": n_with_audio,
        "jsonl": str(jsonl_path),
        "out": str(out_dir),
    }


def write_card(out_dir: Path, stats: dict, eval_summary: dict | None) -> None:
    card = out_dir / "README.md"
    sections: list[str] = []
    sections.append(f"""---
license: mit
language:
- en
tags:
- creative-writing
- agentic
- long-form
- worldbuilding
- benchmark
- hermes-4
- kimi-k2
size_categories:
- n<1K
task_categories:
- text-generation
configs:
- config_name: default
  data_files: canon.jsonl
---

# Chroniclon Canon — autonomous wiki of a fictional civilization

A corpus of `{stats["n_articles"]}` long-form wiki articles written
autonomously by an agentic pipeline of **Hermes-4-70B** (canon decision +
adversarial critics + cross-linking) and **Kimi-K2.6** (long-form prose).
Every article is grounded in a Hermes Genesis simulation event. Every era
includes a generated linguistic drift and an art-style register.

`{stats["n_with_image"]}` of `{stats["n_articles"]}` articles ship with a
FLUX-rendered hero image grounded in the era's art style and the lead
character's genome. `{stats["n_with_audio"]}` ship with TTS narration in
an archetype voice (warrior / schemer / scholar / mystic / narrator)
selected from the same genome.

## Source

Generated by [Chroniclon](https://github.com/Ridwannurudeen/hermes-genesis)
running 24/7 against a single seed world: *"A world where the moon is
sentient and writes letters to the queen."*

## Use

```python
from datasets import load_dataset
ds = load_dataset("Ridwannurudeen/chroniclon-canon-v1")
for row in ds["train"].select(range(3)):
    print(row["title"], "—", row["voice"], "—", row["word_count"], "words")
    print(row["body_md"][:240])
```

## Schema

| Field | Type | Notes |
|---|---|---|
| `article_id` | str | stable identifier |
| `slug` | str | URL-safe, derived from title |
| `title` | str | in-world title |
| `kind` | str | event / person / faction / place / language / concept / artifact / prophecy |
| `voice` | str | scholarly / diary / newspaper / scripture / court |
| `era_id`, `era_name`, `era_art_style` | str | linguistic + visual register |
| `in_world_year` | int | absolute in-world year |
| `body_md` | str | the article (markdown, with `[[slug]]` cross-links) |
| `word_count` | int | |
| `backlinks` | list[str] | outbound `[[slug]]` references |
| `inbound` | list[str] | incoming references from sibling articles |
| `anti_slop_score` | float\\|null | Hermes-4 critic, 0.0 (slop) to 1.0 (sharp) |
| `fact_check_score` | float\\|null | Hermes-4 critic, 0.0 (rejects canon) to 1.0 (no contradictions) |
| `critic_passes` | int | 1 if first draft accepted, 2 if revised once |
| `illustration_path` | str\\|null | relative path under `images/` |
| `audio_path` | str\\|null | relative path under `audio/` |
| `contributor` | str\\|null | `null` = autonomous, `@handle` = audience-submitted |
| `created_at`, `updated_at` | str | ISO 8601 |
""")

    if eval_summary:
        sections.append("\n## Eval — long-form coherence by writer\n")
        for writer, s in eval_summary.items():
            sections.append(f"### {writer}\n")
            for k, v in s.items():
                sections.append(f"- **{k}**: `{v}`")
            sections.append("")

    sections.append(
        "\n## Citation\n\n"
        "```\n"
        "@misc{chroniclon-canon-v1,\n"
        "  title = {Chroniclon Canon: an autonomous Hermes-4 + Kimi-K2 wiki of a fictional civilization},\n"
        "  author = {Nurudeen, Ridwan},\n"
        f"  year = {{{datetime.utcnow().year}}},\n"
        "  url   = {https://huggingface.co/datasets/Ridwannurudeen/chroniclon-canon-v1}\n"
        "}\n"
        "```\n"
    )

    card.write_text("\n".join(sections), encoding="utf-8")


def maybe_push(out_dir: Path, repo_id: str) -> None:
    try:
        from huggingface_hub import HfApi  # noqa: F401
    except ImportError:
        raise SystemExit("huggingface_hub not installed. pip install huggingface_hub")
    from huggingface_hub import HfApi
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_TOKEN")
    api = HfApi(token=token)
    api.create_repo(repo_id=repo_id, repo_type="dataset", exist_ok=True)
    api.upload_folder(folder_path=str(out_dir), repo_id=repo_id, repo_type="dataset")
    print(f"\nPushed: https://huggingface.co/datasets/{repo_id}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data-dir", default=str(DEFAULT_DATA), help="CHRONICLON_DIR (default: ./data/chroniclon)")
    p.add_argument("--out", default=str(DEFAULT_OUT), help="Output bundle dir (default: ./hf_dataset)")
    p.add_argument("--repo", default="Ridwannurudeen/chroniclon-canon-v1", help="HuggingFace dataset repo id")
    p.add_argument("--push", action="store_true", help="Upload to HuggingFace after packing")
    p.add_argument("--eval-summary", default="docs/eval/results.json", help="Optional eval summary to embed in dataset card")
    args = p.parse_args()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out)
    if not out_dir.is_absolute():
        out_dir = REPO_ROOT / out_dir

    stats = pack(data_dir, out_dir)

    eval_summary = None
    eval_path = REPO_ROOT / args.eval_summary if not Path(args.eval_summary).is_absolute() else Path(args.eval_summary)
    if eval_path.exists():
        try:
            eval_summary = json.loads(eval_path.read_text(encoding="utf-8")).get("summary")
        except Exception:
            pass

    write_card(out_dir, stats, eval_summary)
    print(json.dumps(stats, indent=2))

    if args.push:
        maybe_push(out_dir, args.repo)


if __name__ == "__main__":
    main()
