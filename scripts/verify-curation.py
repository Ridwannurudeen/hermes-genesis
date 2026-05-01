#!/usr/bin/env python3
"""Replicate Landing's featured-pick + diversity curation against live data.
Verifies that our two ElevenLabs-narrated articles surface as featured."""
import json
import re
import sys

items = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/list.json"))["items"]

def score(x):
    slop = x.get("anti_slop_score") or 0.5
    fact = x.get("fact_check_score") or 0.5
    media = (0.15 if x.get("illustration_url") else 0) + (0.25 if x.get("audio_url") else 0)
    return slop * 0.4 + fact * 0.4 + media + 0.2

STOP = {"The", "And", "Of", "A", "An", "In", "On"}

def lead_subject(title: str) -> str:
    tokens = [t for t in re.split(r"[\s:·,.]+", title) if t]
    for t in tokens:
        clean = re.sub(r"[^A-Za-z]", "", t)
        if len(clean) >= 4 and clean[:1].isupper() and clean not in STOP:
            return clean.lower()
    return tokens[0].lower() if tokens else ""

# Slug-dedupe (defense in depth)
seen_slugs: set[str] = set()
dedup = []
for x in items:
    s = x["slug"]
    if s in seen_slugs:
        continue
    seen_slugs.add(s)
    dedup.append(x)

sorted_items = sorted(dedup, key=score, reverse=True)

seen_subjects: dict[str, int] = {}
seen_kinds: dict[str, int] = {}
picked = []
for x in sorted_items:
    subj = lead_subject(x["title"])
    if seen_subjects.get(subj, 0) >= 2:
        continue
    if seen_kinds.get(x["kind"], 0) >= 3:
        continue
    picked.append(x)
    seen_subjects[subj] = seen_subjects.get(subj, 0) + 1
    seen_kinds[x["kind"]] = seen_kinds.get(x["kind"], 0) + 1
    if len(picked) >= 7:
        break

lead = next((x for x in picked if x.get("audio_url") and x.get("illustration_url")), None)
if not lead:
    lead = next((x for x in picked if x.get("illustration_url")), None)
if not lead and picked:
    lead = picked[0]

print("=== featured lead ===")
if lead:
    s = lead["slug"]
    audio = bool(lead.get("audio_url"))
    ill = bool(lead.get("illustration_url"))
    print(f"  slug:  {s}")
    print(f"  title: {lead['title']}")
    print(f"  audio={audio}  ill={ill}  score={score(lead):.3f}")
print()
print("=== rest of latest canon ===")
rest = [x for x in picked if x["article_id"] != (lead["article_id"] if lead else None)][:6]
for i, x in enumerate(rest, 1):
    a = "a" if x.get("audio_url") else " "
    il = "i" if x.get("illustration_url") else " "
    print(f"  {i}. [{a}{il}] score={score(x):.3f}  {x['slug'][:55]}")
print()
elevenlabs_slugs = {
    "the-inkwell-parchmentshield-betrayal-seraphinas-final-entry",
    "lyor-inkwell-final-entry",
}
all_picked_slugs = {x["slug"] for x in picked}
hits = elevenlabs_slugs & all_picked_slugs
print(f"=== ElevenLabs articles in front-page selection: {len(hits)}/2 ===")
for s in hits:
    print(f"  ✓ {s}")
for s in elevenlabs_slugs - all_picked_slugs:
    print(f"  ✗ MISSING: {s}")
