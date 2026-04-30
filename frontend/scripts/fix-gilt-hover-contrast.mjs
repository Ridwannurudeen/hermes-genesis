#!/usr/bin/env node
/**
 * Light-mode `hover:text-gilt-400` (#D4A85F) on paper-50 fails WCAG (2.12:1).
 * Dark-mode hover should keep gilt-400 (good contrast on night-950: 8.98:1).
 *
 * Replace bare `hover:text-gilt-400` with the contrast-aware pair:
 *   `hover:text-gilt-600 dark:hover:text-gilt-400`
 *
 * Run: node scripts/fix-gilt-hover-contrast.mjs --write
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const WRITE = process.argv.includes('--write');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', 'src');

const RX = /\bhover:text-gilt-400\b(?!\s*dark:hover)/g;
const REPLACEMENT = 'hover:text-gilt-600 dark:hover:text-gilt-400';

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry)) yield p;
  }
}

let totalSubs = 0;
let touched = 0;
for (const file of walk(ROOT)) {
  const original = readFileSync(file, 'utf8');
  let count = 0;
  const next = original.replace(RX, () => {
    count++;
    return REPLACEMENT;
  });
  if (count > 0) {
    touched++;
    totalSubs += count;
    if (WRITE) writeFileSync(file, next);
    console.log(`  ${WRITE ? 'wrote' : 'would-write'} ${count}× ${file.slice(ROOT.length).replace(/\\/g, '/')}`);
  }
}

console.log(`\n${touched} files, ${totalSubs} substitutions ${WRITE ? 'applied' : 'planned'}`);
if (!WRITE) console.log('(dry-run — pass --write to apply)');
