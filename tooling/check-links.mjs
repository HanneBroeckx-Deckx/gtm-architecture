#!/usr/bin/env node
/**
 * Resolves every relative link in every markdown file.
 *
 *   node tooling/check-links.mjs
 *
 * Documentation that links to files which do not exist is worse than
 * documentation with no links: it teaches people not to trust the map.
 *
 * Zero dependencies. Node 18+.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, relative } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['.git', 'node_modules', 'dist']);

const C = process.stdout.isTTY
  ? { r: '\x1b[31m', g: '\x1b[32m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { r: '', g: '', d: '', b: '', x: '' };

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

const LINK_RE = /\[[^\]]*\]\(([^)\s]+)\)/g;
const files = walk(ROOT);

let checked = 0;
const broken = [];

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const base = dirname(file);
  for (const m of src.matchAll(LINK_RE)) {
    const raw = m[1];
    if (/^(https?:|mailto:|#)/.test(raw)) continue;
    const [path, anchor] = raw.split('#');
    if (!path) continue;
    checked++;
    const target = resolve(base, path);
    if (!existsSync(target)) {
      broken.push({ file, raw, reason: 'target does not exist' });
      continue;
    }
    if (anchor && statSync(target).isFile() && target.endsWith('.md')) {
      const slugs = new Set(
        readFileSync(target, 'utf8')
          .split('\n')
          .filter(l => /^#{1,6}\s/.test(l))
          .map(l => l.replace(/^#{1,6}\s+/, '').trim().toLowerCase()
                     .replace(/[^\w\s-]/g, '').replace(/\s/g, '-'))
      );
      // explicit <a id="..."> anchors count too
      for (const a of readFileSync(target, 'utf8').matchAll(/<a\s+id="([^"]+)"/g)) slugs.add(a[1]);
      if (!slugs.has(anchor.toLowerCase())) {
        broken.push({ file, raw, reason: `anchor #${anchor} not found in target` });
      }
    }
  }
}

console.log('');
console.log(`${C.b}Link check${C.x} ${C.d}${files.length} files · ${checked} relative links${C.x}`);
console.log('');

if (broken.length) {
  for (const b of broken) {
    console.log(`  ${C.r}✗${C.x} ${C.b}${relative(ROOT, b.file)}${C.x}`);
    console.log(`    ${b.raw}  ${C.d}— ${b.reason}${C.x}`);
  }
  console.log('');
  console.log(`${C.r}FAILED${C.x} — ${broken.length} broken link${broken.length === 1 ? '' : 's'}`);
  console.log('');
  process.exit(1);
}

console.log(`${C.g}PASSED${C.x} — every relative link resolves`);
console.log('');
