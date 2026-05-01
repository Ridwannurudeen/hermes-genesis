#!/usr/bin/env node
// Map dead `genesis-*` palette references to gilt/vellum/ink. The strict
// editorial palette dropped the genesis scale; without this migration these
// classes silently render with no color.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'src');

// Shade-preserving map. genesis-* was a warm-gilt range in the original
// Cinzel-style palette. Keep the visual intent: accent / hover states.
const SHADE_MAP = {
  '50':  'vellum-50',
  '100': 'vellum-100',
  '200': 'gilt-400',
  '300': 'gilt-400',
  '400': 'gilt-500',
  '500': 'gilt-500',
  '600': 'gilt-600',
  '700': 'ink-700',
  '800': 'ink-800',
  '900': 'ink-900',
  '950': 'night-950',
};

function transformClassString(s) {
  return s.replace(/\bgenesis-(\d{2,3})\b/g, (_, shade) => {
    return SHADE_MAP[shade] || `gilt-500`;
  });
}

const PATTERNS = [/className="([^"]*)"/g, /className=\{`([^`]*)`\}/g];

let touched = 0;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx|jsx)$/.test(entry)) continue;
    const before = readFileSync(full, 'utf8');
    let after = before;
    for (const re of PATTERNS) {
      after = after.replace(re, (match, value) => {
        const v2 = transformClassString(value);
        if (v2 === value) return match;
        return match.startsWith('className="') ? `className="${v2}"` : `className={\`${v2}\`}`;
      });
    }
    if (after !== before) {
      writeFileSync(full, after, 'utf8');
      touched += 1;
      console.log('updated', full.replace(ROOT, ''));
    }
  }
}

walk(ROOT);
console.log(`\nDone. ${touched} files updated.`);
