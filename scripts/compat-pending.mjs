#!/usr/bin/env node
/**
 * The production SQL a release still owes, from docs/database.md (Phase 49).
 *
 *   node scripts/compat-pending.mjs <base-ref>     prints the SQL to stdout
 *
 * Every block of production SQL in docs/database.md since Phase 49 is fenced with a label:
 *
 *   ```sql release=phase-50
 *
 * The blocks pending against <base-ref> (the last release's tag) are the labelled blocks in today's
 * docs/database.md whose label <base-ref>'s copy does not have, in today's order. The docs stay the
 * one record of what production was given: there is no migrations folder, and this only reads them.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const base = process.argv[2];
if (!base) {
  console.error('usage: node scripts/compat-pending.mjs <base-ref>');
  process.exit(2);
}

const FENCE = /^```sql release=([\w.-]+)\s*\n([\s\S]*?)^```\s*$/gm;
function blocks(text) {
  return [...text.matchAll(FENCE)].map((m) => ({ label: m[1], sql: m[2] }));
}

const today = blocks(readFileSync(join(ROOT, 'docs', 'database.md'), 'utf8'));
let before = '';
try {
  before = execFileSync('git', ['show', `${base}:docs/database.md`], { cwd: ROOT, encoding: 'utf8' });
} catch {
  console.error(`compat-pending: ${base} has no docs/database.md.`);
  process.exit(1);
}
const done = new Set(blocks(before).map((b) => b.label));
const seen = new Set();
for (const block of today) {
  if (seen.has(block.label)) {
    console.error(`compat-pending: the label ${block.label} is used twice in docs/database.md.`);
    process.exit(1);
  }
  seen.add(block.label);
}
const pending = today.filter((b) => !done.has(b.label));
process.stderr.write(`compat-pending: ${pending.length} block(s) pending since ${base}${pending.length ? `: ${pending.map((b) => b.label).join(', ')}` : ''}.\n`);
for (const block of pending) process.stdout.write(`-- ${block.label}\n${block.sql}\n`);
