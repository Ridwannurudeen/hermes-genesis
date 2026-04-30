#!/usr/bin/env python3
"""Backfill world visibility on existing JSON files.

Strategy: any pre-existing world without a `visibility` field gets `unlisted`
(reachable by direct URL, not in public list). The curated demo worlds get
`public`. Run once on the VPS after deploying the visibility schema.

Usage:
    DATA_DIR=/opt/genesis/data/worlds python scripts/migrate-world-visibility.py [--dry-run]

Curated public demos (override list, by name match):
    Wellspring Kingdom, Neuroglade Enclave, Lionheart Citadel,
    Lunar Epistles, Whisper Hollow
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

CURATED_DEMO_NAMES = {
    "Wellspring Kingdom",
    "Neuroglade Enclave",
    "Lionheart Citadel",
    "Lunar Epistles",
    "Whisper Hollow",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="report changes without writing")
    parser.add_argument("--data-dir", default=os.getenv("DATA_DIR", "data/worlds"))
    args = parser.parse_args()

    d = Path(args.data_dir)
    if not d.exists():
        print(f"data dir not found: {d}", file=sys.stderr)
        return 2

    files = sorted(d.glob("world_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    promoted: list[str] = []
    defaulted: list[str] = []
    skipped: list[str] = []

    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  skip (parse error): {f.name}: {e}", file=sys.stderr)
            continue

        existing = data.get("visibility")
        if existing in ("public", "unlisted", "private"):
            skipped.append(f"{data.get('name')} ({existing})")
            continue

        if data.get("name") in CURATED_DEMO_NAMES:
            data["visibility"] = "public"
            promoted.append(f"{data.get('name')} ({data.get('id')})")
        else:
            data["visibility"] = "unlisted"
            defaulted.append(f"{data.get('name')} ({data.get('id')})")

        if not args.dry_run:
            f.write_text(json.dumps(data, indent=2), encoding="utf-8")

    print(f"\nMigration {'(dry-run) ' if args.dry_run else ''}summary:")
    print(f"  promoted to public: {len(promoted)}")
    for n in promoted:
        print(f"    + {n}")
    print(f"  defaulted to unlisted: {len(defaulted)}")
    for n in defaulted[:10]:
        print(f"    · {n}")
    if len(defaulted) > 10:
        print(f"    ... and {len(defaulted) - 10} more")
    print(f"  skipped (already had visibility): {len(skipped)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
