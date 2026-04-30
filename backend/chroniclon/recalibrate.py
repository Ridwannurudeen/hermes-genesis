"""Re-score existing articles against the latest critic prompts.

After tuning the anti-slop and fact-check prompts (calibration anchors,
removed contradictory STRICT JSON instruction, dropped 0.0 placeholder
example) we want to re-run the critics on the canon already on disk so
the displayed scores reflect the real quality of the prose, not the
old prompt's harshness bias.

Usage:
    docker exec genesis-api python -m chroniclon.recalibrate --all
    docker exec genesis-api python -m chroniclon.recalibrate --slug some-slug
    docker exec genesis-api python -m chroniclon.recalibrate --all --only-zero
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from datetime import datetime

from chroniclon import store
from chroniclon.critics import antislop_score, factcheck_score


logger = logging.getLogger("chroniclon.recalibrate")


def _canon_facts_for(era_id: str, exclude_slug: str, limit: int = 30) -> list[str]:
    """Match canon_agent._canon_facts_for: title + first sentence per article in this era."""
    rows = store.list_articles(era_id=era_id, limit=limit + 1)
    facts: list[str] = []
    for r in rows:
        if r["slug"] == exclude_slug:
            continue
        a = store.load_article_by_slug(r["slug"])
        if not a:
            continue
        body = a.body_md
        lines = [ln.strip() for ln in body.split("\n") if ln.strip() and not ln.strip().startswith("#")]
        first = lines[0] if lines else ""
        first = first.split(". ")[0][:240]
        facts.append(f"{a.title} ({a.kind}, year {a.in_world_year}): {first}")
        if len(facts) >= limit:
            break
    return facts


async def rescore_one(slug: str) -> dict:
    article = store.load_article_by_slug(slug)
    if article is None:
        return {"slug": slug, "error": "not found"}

    canon = _canon_facts_for(article.era_id, exclude_slug=slug)
    slop = await antislop_score(article.body_md)
    fact = await factcheck_score(article.body_md, canon)

    before = {"slop": article.anti_slop_score, "fact": article.fact_check_score}

    async with store.article_lock_by_slug(slug):
        latest = store.load_article_by_slug(slug) or article
        latest.anti_slop_score = float(slop["score"])
        latest.fact_check_score = float(fact["score"])
        latest.updated_at = datetime.utcnow()
        store.save_article(latest)

    return {
        "slug": slug,
        "before": before,
        "after": {"slop": float(slop["score"]), "fact": float(fact["score"])},
        "verdict": fact.get("verdict"),
    }


async def rescore_all(only_zero: bool = False, limit: int | None = None, pause: float = 1.0) -> dict:
    rows = store.list_articles(limit=limit or 10_000)
    rescored = skipped = failed = 0
    deltas: list[dict] = []
    for r in rows:
        slug = r["slug"]
        a = store.load_article_by_slug(slug)
        if not a:
            failed += 1
            continue
        if only_zero:
            s = a.anti_slop_score
            f = a.fact_check_score
            if not ((s is not None and s == 0.0) or (f is not None and f == 0.0)):
                skipped += 1
                continue
        try:
            result = await rescore_one(slug)
            if "error" in result:
                failed += 1
                continue
            deltas.append(result)
            rescored += 1
            logger.info(
                f"[{rescored}] {slug}: "
                f"slop {result['before']['slop']} -> {result['after']['slop']:.2f} | "
                f"fact {result['before']['fact']} -> {result['after']['fact']:.2f}"
            )
        except Exception as ex:  # noqa: BLE001
            logger.warning(f"rescore failed for {slug}: {ex}")
            failed += 1
        await asyncio.sleep(pause)
    return {
        "rescored": rescored,
        "skipped": skipped,
        "failed": failed,
        "total": len(rows),
        "deltas": deltas,
    }


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        stream=sys.stdout,
    )
    parser = argparse.ArgumentParser(description="Re-score canon articles against the latest critic prompts.")
    parser.add_argument("--slug", help="rescore one article by slug")
    parser.add_argument("--all", action="store_true", help="rescore every article")
    parser.add_argument("--only-zero", action="store_true", help="rescore only articles with a 0.0 score")
    parser.add_argument("--limit", type=int, default=None, help="cap how many articles to process")
    parser.add_argument("--pause", type=float, default=1.0, help="seconds between calls (rate limiting)")
    args = parser.parse_args()

    if args.all:
        result = asyncio.run(rescore_all(only_zero=args.only_zero, limit=args.limit, pause=args.pause))
        print(
            f"\nDONE: rescored={result['rescored']} skipped={result['skipped']} "
            f"failed={result['failed']} (total={result['total']})"
        )
        return

    if not args.slug:
        parser.error("Provide --slug <slug> or --all.")

    result = asyncio.run(rescore_one(args.slug))
    if "error" in result:
        raise SystemExit(f"error: {result['error']}")
    print(
        f"\n{result['slug']}\n"
        f"  slop: {result['before']['slop']} -> {result['after']['slop']:.2f}\n"
        f"  fact: {result['before']['fact']} -> {result['after']['fact']:.2f}\n"
        f"  verdict: {result.get('verdict')}"
    )


if __name__ == "__main__":
    main()
