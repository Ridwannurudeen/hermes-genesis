#!/usr/bin/env node
/**
 * Capture the four missing README screenshots via Puppeteer.
 * Run: cd <repo>; node scripts/capture-screenshots.mjs
 *
 * Why this exists: the Playwright MCP server was blocked by the agent's
 * cwd (C:\Windows\System32 — no write permission). A regular Node script
 * launched with the user's permissions works.
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '..', 'docs', 'screenshots');

const SHOTS = [
  {
    file: 'glossary.png',
    url: 'https://hermesgenesis.world/glossary',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1920, height: 1400 },
    waitFor: 1500,
  },
  {
    file: 'lexicon-preview.png',
    url: 'https://hermesgenesis.world/',
    fullPage: false,
    // Scroll down to the LexiconPreview section
    scrollSelector: 'h2',
    scrollMatchText: 'language drifts',
    clip: { y: -40, height: 700 },
    waitFor: 2000,
  },
  {
    file: 'nav-with-freshness.png',
    url: 'https://hermesgenesis.world/chronicle',
    fullPage: false,
    clip: { x: 0, y: 0, width: 1920, height: 56 },
    waitFor: 1500,
  },
  {
    file: 'watch-cinematic.png',
    url: 'https://hermesgenesis.world/watch',
    fullPage: false,
    waitFor: 6000, // wait for redirect + cinematic to open
  },
];

async function main() {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch {
    try {
      puppeteer = (await import('puppeteer-core')).default;
    } catch {
      console.error('Neither puppeteer nor puppeteer-core installed.');
      console.error('Run: npm install --no-save puppeteer  (downloads Chromium ~170MB)');
      process.exit(1);
    }
  }

  await mkdir(OUT, { recursive: true });
  // Explicit Chrome path — avoids the WS-endpoint timeout puppeteer's
  // bundled Chromium hits on this Windows + node_modules path config.
  const chromePath = process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 60_000,
  });

  for (const shot of SHOTS) {
    console.log(`→ ${shot.file}  (${shot.url})`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(shot.url, { waitUntil: 'networkidle2', timeout: 30_000 });
    await new Promise((r) => setTimeout(r, shot.waitFor || 1000));

    if (shot.scrollMatchText) {
      await page.evaluate((needle) => {
        const els = Array.from(document.querySelectorAll('h2, h3'));
        const target = els.find((e) => e.textContent && e.textContent.toLowerCase().includes(needle.toLowerCase()));
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      }, shot.scrollMatchText);
      await new Promise((r) => setTimeout(r, 800));
    }

    const path = resolve(OUT, shot.file);
    if (shot.clip) {
      await page.screenshot({
        path,
        clip: { x: 0, ...shot.clip, width: shot.clip.width || 1920 },
      });
    } else {
      await page.screenshot({ path, fullPage: !!shot.fullPage });
    }
    await page.close();
    console.log(`  saved ${path}`);
  }

  await browser.close();
  console.log('done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
