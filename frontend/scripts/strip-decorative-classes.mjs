#!/usr/bin/env node
// Strip legacy decorative class names from JSX className strings ONLY,
// replacing with editorial Tailwind utilities. Scoped to className="..."
// and className={`...`} so source indentation is never touched.
// Run from frontend/: node scripts/strip-decorative-classes.mjs
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'src');

// Per-class transforms applied INSIDE a className value only.
function transformClassString(s) {
  let out = s;
  // font-serif → font-display for headings (heading-y context),
  // font-body for italic/inline serif voice.
  if (/\bfont-serif\b/.test(out)) {
    const isInlineSerif =
      /\bitalic\b/.test(out) ||
      /\bresize-none\b/.test(out) ||           // textarea
      /\btext-sm\b|\btext-xs\b/.test(out);     // small inline body
    out = out.replace(/\bfont-serif\b/g, isInlineSerif ? 'font-body' : 'font-display');
  }
  // glass-input is form-input surface.
  out = out.replace(/\bglass-input\b/g, 'bg-surface border border-subtle focus:border-gilt-500/60 transition-colors');
  // glass is a card surface.
  out = out.replace(/\bglass\b(?!-)/g, 'bg-surface border border-subtle');
  // text-shimmer was gradient text — now just heading color.
  out = out.replace(/\btext-shimmer\b/g, 'text-heading');
  // card-glow → hover ring.
  out = out.replace(/\bcard-glow\b/g, 'hover:border-gilt-500/40 transition-colors');
  // btn-glow + icon-aura: pure decoration, drop them.
  out = out.replace(/\bbtn-glow\b/g, '');
  out = out.replace(/\bicon-aura\b/g, '');
  // Collapse leftover doubled internal spaces (only inside the className value).
  out = out.replace(/[ \t]+/g, ' ').trim();
  return out;
}

// Match className="..." (no nested quotes) and className={`...`} (no nested backticks).
// Only the value between the delimiters is rewritten.
const PATTERNS = [
  /className="([^"]*)"/g,
  /className=\{`([^`]*)`\}/g,
];

let touched = 0;
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(tsx|jsx)$/.test(entry)) continue;
    const before = readFileSync(full, 'utf8');
    let after = before;
    for (const re of PATTERNS) {
      after = after.replace(re, (match, value) => {
        const newValue = transformClassString(value);
        if (newValue === value) return match;
        const delim = match.startsWith('className="') ? '"' : '`';
        return match.startsWith('className="')
          ? `className="${newValue}"`
          : `className={\`${newValue}\`}`;
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
