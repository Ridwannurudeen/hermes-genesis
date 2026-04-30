#!/usr/bin/env node
/**
 * One-shot Tailwind palette migration: default Tailwind colors → editorial-AI
 * tokens (paper / ink / vellum / night / gilt / crimson / moss).
 *
 * Replaces every `<prefix>-<oldFamily>-<shade>` occurrence in src/**\/*.{ts,tsx}
 * with the matching editorial scale, where the prefix is one of:
 *   text- bg- border- ring- ring-offset- from- via- to- divide- placeholder-
 *   fill- stroke- caret- accent-
 * and the old family is one of the Tailwind defaults we want gone.
 *
 * Usage: node scripts/migrate-tokens.mjs        (dry-run)
 *        node scripts/migrate-tokens.mjs --write
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const WRITE = process.argv.includes('--write');
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', 'src');

// Each entry: [oldFamily, mapping per shade → editorial replacement].
// Replacements are family-only ("ink", "gilt") — the prefix and shade are
// preserved separately so `bg-slate-950` becomes `bg-ink-900` (closest shade).
//
// Shade-mapping rule per family:
//   - cool/grey scales (slate, gray, zinc, stone, neutral) → ink (light) /
//     vellum (dark) family. We map all to `ink` since CSS-var aliases handle
//     light/dark via .dark class.
//   - warm/saturated scales fold into the single semantic accent.
//
// Shade approximation:
//   slate-50  → vellum-50    slate-100 → vellum-100   slate-200 → vellum-200
//   slate-300 → vellum-300   slate-400 → vellum-400   slate-500 → ink-500
//   slate-600 → ink-600      slate-700 → ink-700      slate-800 → ink-800
//   slate-900 → ink-900      slate-950 → night-950
//
// We bias toward the dark-mode family (ink/night) because Chroniclon defaults
// to dark; the var-based utilities (text-page, bg-page, etc.) handle light.

const SHADE_TO_INK = {
  '50':  'vellum-50',
  '100': 'vellum-100',
  '200': 'vellum-200',
  '300': 'vellum-300',
  '400': 'vellum-400',
  '500': 'ink-500',
  '600': 'ink-600',
  '700': 'ink-700',
  '800': 'ink-800',
  '900': 'ink-900',
  '950': 'night-950',
};

// Single-accent (gilt) scale.
const SHADE_TO_GILT = {
  '50':  'gilt-400',
  '100': 'gilt-400',
  '200': 'gilt-400',
  '300': 'gilt-400',
  '400': 'gilt-400',
  '500': 'gilt-500',
  '600': 'gilt-500',
  '700': 'gilt-600',
  '800': 'gilt-600',
  '900': 'gilt-600',
  '950': 'gilt-600',
};

// Crimson alert scale.
const SHADE_TO_CRIMSON = {
  '50':  'crimson-400',
  '100': 'crimson-400',
  '200': 'crimson-400',
  '300': 'crimson-400',
  '400': 'crimson-400',
  '500': 'crimson-500',
  '600': 'crimson-500',
  '700': 'crimson-500',
  '800': 'crimson-600',
  '900': 'crimson-600',
  '950': 'crimson-600',
};

// Moss "canonized" scale.
const SHADE_TO_MOSS = {
  '50':  'moss-400',
  '100': 'moss-400',
  '200': 'moss-400',
  '300': 'moss-400',
  '400': 'moss-400',
  '500': 'moss-500',
  '600': 'moss-500',
  '700': 'moss-500',
  '800': 'moss-500',
  '900': 'moss-500',
  '950': 'moss-500',
};

const FAMILY_MAP = {
  // Cool / grey families → ink+vellum scale
  slate: SHADE_TO_INK,
  gray: SHADE_TO_INK,
  zinc: SHADE_TO_INK,
  stone: SHADE_TO_INK,
  neutral: SHADE_TO_INK,

  // Warm accent families → gilt
  amber: SHADE_TO_GILT,
  yellow: SHADE_TO_GILT,
  orange: SHADE_TO_GILT,

  // Reds → crimson
  red: SHADE_TO_CRIMSON,
  rose: SHADE_TO_CRIMSON,
  pink: SHADE_TO_CRIMSON,
  fuchsia: SHADE_TO_CRIMSON,

  // Greens → moss
  green: SHADE_TO_MOSS,
  emerald: SHADE_TO_MOSS,
  teal: SHADE_TO_MOSS,
  lime: SHADE_TO_MOSS,

  // Cool blues / violets → vellum (passive) for non-load-bearing decoration
  blue: SHADE_TO_INK,
  sky: SHADE_TO_INK,
  cyan: SHADE_TO_INK,
  indigo: SHADE_TO_INK,
  violet: SHADE_TO_GILT,
  purple: SHADE_TO_GILT,
  warm: SHADE_TO_INK,
};

// Class-prefix list — anywhere a Tailwind color shows up.
const PREFIXES = [
  'text-',
  'bg-',
  'border-',
  'border-t-',
  'border-r-',
  'border-b-',
  'border-l-',
  'ring-',
  'ring-offset-',
  'from-',
  'via-',
  'to-',
  'divide-',
  'placeholder-',
  'fill-',
  'stroke-',
  'caret-',
  'accent-',
  'outline-',
  'shadow-',
  'decoration-',
];

/** Walk a directory, yield .ts/.tsx file paths. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry)) yield p;
  }
}

const families = Object.keys(FAMILY_MAP).join('|');
// Match: optional negative prefix `-` (some Tailwind utilities), the prefix,
// the family, dash, shade, optional `/<alpha>` suffix for opacity. We
// preserve the alpha suffix verbatim.
const RX = new RegExp(
  `\\b(${PREFIXES.map((p) => p.replace('-', '\\-')).join('|')})(${families})-(50|100|200|300|400|500|600|700|800|900|950)(\\/[0-9.]+)?\\b`,
  'g',
);

let totalFiles = 0;
let touchedFiles = 0;
let totalSubs = 0;

for (const file of walk(ROOT)) {
  totalFiles++;
  const original = readFileSync(file, 'utf8');
  let count = 0;
  const next = original.replace(RX, (full, prefix, family, shade, alpha) => {
    const map = FAMILY_MAP[family];
    if (!map) return full;
    const replacement = map[shade];
    if (!replacement) return full;
    count++;
    return `${prefix}${replacement}${alpha ?? ''}`;
  });
  if (count > 0) {
    touchedFiles++;
    totalSubs += count;
    if (WRITE) writeFileSync(file, next);
    console.log(`  ${WRITE ? 'wrote' : 'would-write'} ${count.toString().padStart(3)}× ${file.slice(ROOT.length).replace(/\\/g, '/')}`);
  }
}

console.log('');
console.log(`Files scanned: ${totalFiles}`);
console.log(`Files ${WRITE ? 'modified' : 'to modify'}: ${touchedFiles}`);
console.log(`Substitutions ${WRITE ? 'applied' : 'planned'}: ${totalSubs}`);
if (!WRITE) console.log('\n(dry-run — pass --write to apply)');
