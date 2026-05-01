#!/usr/bin/env node
// Drop redundant `transition-all` when `transition-colors` is also present
// in the same className value. Scoped to className strings only.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', 'src');

function transformClassString(s) {
  if (s.includes('transition-colors') && s.includes('transition-all')) {
    return s
      .replace(/\btransition-all\b/g, '')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
  return s;
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
