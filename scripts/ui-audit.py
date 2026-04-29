"""UI audit — drive Playwright against the live site and check each surface
against the design spec. Saves screenshots + a JSON report. Continues past
per-page failures so a single hang doesn't drop the whole audit."""
import asyncio
import json
import sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "https://hermesgenesis.world"
OUT = Path(__file__).parent.parent / "docs" / "ui-audit"
OUT.mkdir(parents=True, exist_ok=True)
CHROME = r"C:\Users\HP\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe"


async def shoot(page, slug: str, url: str, full: bool = True) -> tuple[str, str]:
    """Navigate + screenshot. Returns (path, body_html). Empty strings on failure."""
    try:
        await page.goto(url, wait_until="commit", timeout=20000)
    except Exception as ex:
        try:
            await page.goto(url, wait_until="load", timeout=15000)
        except Exception:
            print(f"[{slug}] navigation failed: {ex}", file=sys.stderr)
            return "", ""
    await asyncio.sleep(3.5)
    path = OUT / f"{slug}.png"
    saved = ""
    try:
        await page.screenshot(path=str(path), full_page=full, animations="disabled", timeout=10000)
        saved = str(path)
    except Exception:
        try:
            await page.screenshot(path=str(path), full_page=False, animations="disabled", timeout=10000)
            saved = str(path)
        except Exception as ex2:
            print(f"[{slug}] screenshot failed: {ex2}", file=sys.stderr)
    body = ""
    try:
        body = await page.content()
    except Exception:
        pass
    return saved, body


async def run() -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            executable_path=CHROME,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            timeout=60000,
        )
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        page = await ctx.new_page()
        page.set_default_timeout(15000)

        results: list[dict] = []

        # Landing
        try:
            path, body = await shoot(page, "01-landing", f"{BASE}/")
            results.append({
                "surface": "landing", "screenshot": path,
                "checks": {
                    "chroniclon_banner_visible": "new · chroniclon" in body,
                    "hermes_genesis_hero_visible": "HERMES GENESIS" in body,
                    "describe_subtitle": "Describe a world" in body,
                    "kimi_mention_in_banner": "Kimi K2.6" in body,
                    "control_room_link": "control room" in body,
                    "browse_canon_cta": "browse the canon" in body,
                    "powered_by_hermes_4": "Hermes-4-70B" in body,
                },
            })
        except Exception as ex:
            results.append({"surface": "landing", "error": str(ex)})

        # Chronicle home
        try:
            path, body = await shoot(page, "02-chronicle-home", f"{BASE}/chronicle")
            await asyncio.sleep(1.5)
            body = await page.content() if not body else body
            counts = {}
            try:
                counts = await page.evaluate(
                    "() => { const t = document.body.innerText || ''; "
                    "return { image: (t.match(/\\bimage\\b/g)||[]).length, audio: (t.match(/\\baudio\\b/g)||[]).length }; }"
                )
            except Exception:
                pass
            results.append({
                "surface": "chronicle_home", "screenshot": path,
                "checks": {
                    "h1_chroniclon": "Chroniclon" in body,
                    "stats_banner_articles": "articles" in body and "words" in body and "eras" in body,
                    "search_input": 'placeholder="search articles' in body,
                    "control_room_button": "control room" in body,
                    "regen_button": ">regen<" in body,
                    "contribute_button": "contribute" in body,
                    "image_badge_count": counts.get("image", 0),
                    "audio_badge_count": counts.get("audio", 0),
                },
            })
        except Exception as ex:
            results.append({"surface": "chronicle_home", "error": str(ex)})

        # Article detail (pull first slug from API)
        try:
            first_slug = await page.evaluate(
                "async () => { const r = await fetch('/api/chronicle/articles?limit=1'); "
                "const d = await r.json(); return d.items?.[0]?.slug || null; }"
            )
        except Exception:
            first_slug = None
        if first_slug:
            try:
                path, body = await shoot(page, "03-article-detail", f"{BASE}/chronicle/{first_slug}")
                hero = audio_tag = False
                try:
                    hero = await page.evaluate(
                        "() => { const imgs = Array.from(document.querySelectorAll('article img')); "
                        "return imgs.some(i => i.src.includes('/api/chronicle/images/')); }"
                    )
                    audio_tag = await page.evaluate(
                        "() => !!document.querySelector('article audio') || !!document.querySelector('audio')"
                    )
                except Exception:
                    pass
                results.append({
                    "surface": "article_detail", "screenshot": path,
                    "slug": first_slug,
                    "checks": {
                        "hero_image_rendered": hero,
                        "audio_player_present": audio_tag,
                        "back_to_all_link": "all articles" in body,
                        "crosslinks_present": "decoration-dotted" in body,
                    },
                })
            except Exception as ex:
                results.append({"surface": "article_detail", "error": str(ex)})

        # Control Room
        try:
            path, body = await shoot(page, "04-control-room", f"{BASE}/control")
            await asyncio.sleep(2)
            body = await page.content() if not body else body
            backlog = {"count": 0, "sample": []}
            try:
                backlog = await page.evaluate(
                    "async () => { const r = await fetch('/api/chronicle/control/backlog?limit=20'); "
                    "const d = await r.json(); const items = d.items || []; "
                    "return { count: items.length, sample: items.slice(-3).map(e => "
                    "({ phase: e.phase, model: e.model, title: e.event_title || e.title || e.slug })) }; }"
                )
            except Exception:
                pass
            results.append({
                "surface": "control_room", "screenshot": path,
                "checks": {
                    "h1_canon_control_room": "Canon Control Room" in body,
                    "live_indicator_present": "live" in body,
                    "active_pipelines_section": "Active pipelines" in body,
                    "stage_decision": "canon decision" in body,
                    "stage_writing": "long-form prose" in body,
                    "stage_antislop": "anti-slop" in body or "slop" in body,
                    "stage_factcheck": "fact-check" in body,
                    "stage_crosslink": "cross-link" in body,
                    "stage_image": "hero image" in body,
                    "stage_audio": "audio chapter" in body,
                    "model_badge_hermes": "Hermes-4-70B" in body,
                    "model_badge_kimi": "Kimi-K2.6" in body or "Kimi K2.6" in body,
                    "backlog_count": backlog["count"],
                    "backlog_sample": backlog["sample"],
                },
            })
        except Exception as ex:
            results.append({"surface": "control_room", "error": str(ex)})

        # Regen
        try:
            path, body = await shoot(page, "05-regen", f"{BASE}/regen")
            await asyncio.sleep(1.0)
            body = await page.content() if not body else body
            results.append({
                "surface": "regen", "screenshot": path,
                "checks": {
                    "h1_live_regen": "Live regen" in body or "live regen" in body,
                    "kimi_toggle_button": "Kimi K2.6" in body or "Kimi-K2.6" in body,
                    "hermes_toggle_button": "Hermes-4" in body,
                    "regenerate_button": "regenerate the world" in body,
                    "writer_label": "writer" in body,
                    "seed_textarea": "Strange is good" in body,
                },
            })
        except Exception as ex:
            results.append({"surface": "regen", "error": str(ex)})

        await ctx.close()
        await browser.close()

        report = {"results": results}
        (OUT / "audit.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    asyncio.run(run())
