#!/usr/bin/env node
/**
 * How many rows a reset WRITES, estimated before it runs (Phase 49).
 *
 * D1's free plan allows 100,000 rows written a day per account, and an index entry is a row
 * written too. The whole question bank alone was about 150,000, so the demo could not be reseeded
 * in one day. This counts every INSERT's rows in the given files and multiplies each by one plus
 * the table's indexes (from db/schema.sql: CREATE INDEX, UNIQUE, and the automatic index of a
 * non-INTEGER primary key). Triggers and UPDATEs count one each: it is an estimate, on the high
 * side of what matters.
 *
 *   node scripts/seed-budget.mjs [--max=N] <file.sql>...   (paths relative to apps/api)
 *
 * With --max it refuses (exit 1) above N. `db:rebuild:test` runs it with 40,000, under half the
 * demo's daily limit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const API = join(here, '..', 'apps', 'api');
const args = process.argv.slice(2);
const max = Number(args.find((a) => a.startsWith('--max='))?.slice(6) ?? 'NaN');
const files = args.filter((a) => !a.startsWith('--'));

/** Strips SQL comments and splits into statements, respecting quoted strings. */
export function statementsOf(sql) {
  const out = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    if (quote) {
      current += ch;
      if (ch === quote) {
        if (sql[i + 1] === quote) {
          current += sql[i + 1];
          i += 1;
        } else quote = null;
      }
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      current += '\n';
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    if (ch === ';') {
      if (current.trim()) out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** The number of top-level ( ... ) groups after VALUES: the rows one INSERT writes. */
function valueRows(statement) {
  const at = statement.search(/\bVALUES\b/i);
  if (at < 0) return 1; // INSERT ... SELECT: unknown, counted as one
  let depth = 0;
  let quote = null;
  let rows = 0;
  for (let i = at + 6; i < statement.length; i += 1) {
    const ch = statement[i];
    if (quote) {
      if (ch === quote) {
        if (statement[i + 1] === quote) i += 1;
        else quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '(') {
      if (depth === 0) rows += 1;
      depth += 1;
    } else if (ch === ')') depth -= 1;
    else if (depth === 0 && /[A-Za-z]/.test(ch) && /^ON\b/i.test(statement.slice(i))) break;
  }
  return Math.max(rows, 1);
}

/** Indexes per table, from the schema. */
function indexesPerTable(schema) {
  const counts = new Map();
  const add = (table, n = 1) => counts.set(table.toLowerCase(), (counts.get(table.toLowerCase()) ?? 0) + n);
  for (const statement of statementsOf(schema)) {
    let m = statement.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?\S+\s+ON\s+(\w+)/i);
    if (m) {
      add(m[1]);
      continue;
    }
    m = statement.match(/^CREATE\s+TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([\s\S]*)\)\s*(WITHOUT ROWID)?$/i);
    if (!m) continue;
    const [, table, body, withoutRowid] = m;
    // Inline and table-level UNIQUE constraints each make an index.
    add(table, (body.match(/\bUNIQUE\b/gi) ?? []).length);
    // A primary key that is not an INTEGER rowid alias makes one too (unless WITHOUT ROWID).
    const columnPk = body.match(/^\s*\w+\s+(\w+)[^,\n]*\bPRIMARY KEY\b/im);
    const tablePk = /^\s*PRIMARY KEY\s*\(/im.test(body);
    if (!withoutRowid && (tablePk || (columnPk && columnPk[1].toUpperCase() !== 'INTEGER'))) add(table);
    if (!counts.has(table.toLowerCase())) counts.set(table.toLowerCase(), 0);
  }
  return counts;
}

export function estimate(schema, sqlFiles) {
  const indexes = indexesPerTable(schema);
  const perTable = new Map();
  let total = 0;
  for (const sql of sqlFiles) {
    for (const statement of statementsOf(sql)) {
      const insert = statement.match(/^INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
      if (insert) {
        const table = insert[1].toLowerCase();
        const rows = valueRows(statement) * (1 + (indexes.get(table) ?? 0));
        perTable.set(table, (perTable.get(table) ?? 0) + rows);
        total += rows;
      } else if (/^(UPDATE|DELETE)\b/i.test(statement)) {
        total += 1;
      }
    }
  }
  return { total, perTable };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  if (files.length === 0) {
    console.error('usage: node scripts/seed-budget.mjs [--max=N] <file.sql>...');
    process.exit(2);
  }
  const schema = readFileSync(join(API, 'db', 'schema.sql'), 'utf8');
  const { total, perTable } = estimate(
    schema,
    files.map((f) => readFileSync(resolve(API, f), 'utf8')),
  );
  const top = [...perTable.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(
    `seed-budget: about ${total.toLocaleString('en-US')} rows written` +
      ` (largest: ${top.map(([t, n]) => `${t} ${n.toLocaleString('en-US')}`).join(', ')})` +
      (Number.isFinite(max) ? `; the budget is ${max.toLocaleString('en-US')}.` : '.'),
  );
  if (Number.isFinite(max) && total > max) {
    console.error('seed-budget: refusing -- over budget. D1 counts every row and index entry written against the day.');
    process.exit(1);
  }
}
