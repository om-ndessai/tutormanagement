#!/usr/bin/env node
/**
 * Compares two local D1 databases' schemas (Phase 49's backward-compatibility test).
 *
 *   node scripts/compat-schema.mjs <persist-dir-a> <persist-dir-b> [--known=scripts/compat-known.json]
 *
 * `a` is the last release's database with the pending production SQL applied by hand, as
 * production gets it; `b` is a fresh build of today's db/schema.sql. They must agree on:
 *   - the tables, and each one's columns (name, type, NOT NULL, default, primary-key position),
 *     compared as SETS, since ALTER TABLE ... ADD COLUMN appends where schema.sql may not;
 *   - the named indexes (normalised SQL) and how many automatic ones each table has (UNIQUE, PK);
 *   - the triggers (normalised SQL).
 * A difference that cannot be avoided -- a CHECK that ADD COLUMN cannot carry, say -- is listed with
 * its reason in compat-known.json, as { "differences": [{ "match": "<text of the line>", "why": "..." }] }.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const API = join(here, '..', 'apps', 'api');
const [dirA, dirB] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const knownPath = process.argv.find((a) => a.startsWith('--known='))?.slice(8) ?? join(here, 'compat-known.json');
if (!dirA || !dirB) {
  console.error('usage: node scripts/compat-schema.mjs <persist-dir-a> <persist-dir-b>');
  process.exit(2);
}

function query(dir, sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'tutoring-db', '--local', '--persist-to', resolve(dir), '--json', '--command', sql],
    { cwd: API, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(out)[0].results;
}

const normalise = (sql) =>
  (sql ?? '')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([(),;=<>])\s*/g, '$1')
    .replace(/\bIF NOT EXISTS\b/gi, '')
    .trim()
    .toLowerCase();

/** One line per fact, so two schemas compare as sets of lines. */
function model(dir) {
  const lines = new Set();
  const internal = (name) => name.startsWith('sqlite_') || name.startsWith('_cf_') || name === 'd1_migrations';
  const tables = query(dir, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name).filter((n) => !internal(n));
  for (const table of tables) lines.add(`table ${table}`);
  for (const r of query(
    dir,
    `SELECT m.name AS tbl, p.name, p.type, p."notnull" AS nn, p.dflt_value AS dflt, p.pk
     FROM sqlite_master m JOIN pragma_table_info(m.name) p
     WHERE m.type = 'table' AND m.name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND m.name NOT LIKE 'sqlite\\_%' ESCAPE '\\'`,
  )) {
    if (internal(r.tbl)) continue;
    lines.add(`column ${r.tbl}.${r.name} ${String(r.type).toUpperCase()}${r.nn ? ' NOT NULL' : ''}${r.dflt === null ? '' : ` DEFAULT ${normalise(r.dflt)}`}${r.pk ? ` PK${r.pk}` : ''}`);
  }
  for (const r of query(dir, "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index'")) {
    if (internal(r.tbl_name)) continue;
    if (r.sql) lines.add(`index ${r.name}: ${normalise(r.sql)}`);
  }
  for (const r of query(
    dir,
    `SELECT m.name AS tbl, COUNT(*) AS n FROM sqlite_master m JOIN pragma_index_list(m.name) i
     WHERE m.type = 'table' AND m.name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND m.name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
       AND i.origin IN ('u', 'pk') GROUP BY m.name`,
  )) {
    if (!internal(r.tbl)) lines.add(`automatic indexes ${r.tbl}: ${r.n}`);
  }
  for (const r of query(dir, "SELECT name, sql FROM sqlite_master WHERE type = 'trigger'")) {
    lines.add(`trigger ${r.name}: ${normalise(r.sql)}`);
  }
  return lines;
}

const a = model(dirA);
const b = model(dirB);
const known = existsSync(knownPath) ? JSON.parse(readFileSync(knownPath, 'utf8')).differences ?? [] : [];
const isKnown = (line) => known.some((k) => line.includes(k.match));
const onlyA = [...a].filter((l) => !b.has(l) && !isKnown(l)).sort();
const onlyB = [...b].filter((l) => !a.has(l) && !isKnown(l)).sort();

if (onlyA.length === 0 && onlyB.length === 0) {
  console.log(`compat-schema: the migrated database matches schema.sql (${b.size} facts compared).`);
} else {
  console.error('compat-schema: the migrated database does NOT match schema.sql.');
  for (const line of onlyB) console.error(`  missing after the release SQL:  ${line}`);
  for (const line of onlyA) console.error(`  not in schema.sql:              ${line}`);
  console.error('Fix the release SQL in docs/database.md (or schema.sql), or list an unavoidable difference in scripts/compat-known.json.');
  process.exit(1);
}
