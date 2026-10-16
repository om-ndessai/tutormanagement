#!/usr/bin/env node
/**
 * The curriculum catalog, generated (Phase 35).
 *
 *   db/catalog/<curriculum>.json  ->  db/catalog.sql
 *
 * The platform's curricula (Beast Academy, North Carolina Math 2017 and 2026)
 * are reference data: written here, never by the application. Each source file
 * is one curriculum with its levels and their topics. The output is upserts of
 * platform rows only -- never a DELETE -- so it runs against a live database as
 * safely as against an empty one, and re-running it corrects a name without
 * moving a single rating.
 *
 * Every database is built from schema.sql THEN catalog.sql: `db:rebuild`,
 * `db:rebuild:test` and scripts/e2e.sh all run both.
 *
 * Refuses, before writing anything:
 *   - an id that the previous catalog.sql had and the sources no longer do
 *     (ratings reference topics without a cascade: "never delete a topic");
 *   - a level whose stage changed, or that moved to another curriculum; a topic
 *     that moved to another level or changed its number (the database checks
 *     UNIQUE row by row, so a shifted number can fail half-way through);
 *   - a stage outside its curriculum's thousand (Beast Academy 1-999,
 *     nc-2017 1001-1999, nc-2026 2001-2999: one thousand per curriculum,
 *     never shared), or a stage used twice;
 *   - a code (what people read) used twice within one curriculum;
 *   - an id of the wrong shape, or used twice anywhere in the catalog.
 *
 * A curriculum that has never been released to production may be replaced
 * wholesale: name it with --unreleased=<id> (repeatable) and its dropped ids
 * and changed stages are allowed, once. Never use it for one that is live.
 *
 *   node db/generate-catalog.mjs            write db/catalog.sql
 *   node db/generate-catalog.mjs --check    fail if catalog.sql is stale or a
 *                                           source breaks a rule (npm run typecheck)
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(here, 'catalog');
const OUTPUT = join(here, 'catalog.sql');

/** packages/shared/src/progress.ts, CATALOG_ID: the id shape may only ever widen. */
const CATALOG_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
/** D1 caps one statement at 100 KB; stay well under it. */
const MAX_STATEMENT_BYTES = 90_000;

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const unreleased = new Set(
  args.filter((arg) => arg.startsWith('--unreleased=')).map((arg) => arg.slice('--unreleased='.length)),
);

const problems = [];
const problem = (text) => problems.push(text);

// ---------------------------------------------------------------------------
// Read the sources
// ---------------------------------------------------------------------------

const curricula = readdirSync(SOURCES)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    try {
      return { file: name, ...JSON.parse(readFileSync(join(SOURCES, name), 'utf8')) };
    } catch (error) {
      problem(`${name}: not valid JSON (${error.message})`);
      return null;
    }
  })
  .filter(Boolean)
  .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.id).localeCompare(String(b.id)));

const text = (value) => (value === undefined || value === null || value === '' ? null : String(value));

// ---------------------------------------------------------------------------
// The rules a source file must keep on its own
// ---------------------------------------------------------------------------

const seenIds = new Map(); // id -> where
const stageOwner = new Map(); // stage -> level id
const thousandOwner = new Map(); // thousand -> curriculum id

function claimId(id, where) {
  if (typeof id !== 'string' || !CATALOG_ID.test(id)) {
    problem(`${where}: "${id}" is not a catalog id (${CATALOG_ID})`);
    return;
  }
  if (seenIds.has(id)) problem(`${where}: id ${id} is already used by ${seenIds.get(id)}`);
  else seenIds.set(id, where);
}

for (const curriculum of curricula) {
  const where = curriculum.file;
  claimId(curriculum.id, where);
  if (`${curriculum.id}.json` !== curriculum.file) problem(`${where}: its id is "${curriculum.id}"; name the file after it`);
  if (!text(curriculum.name)) problem(`${where}: a curriculum needs a name`);
  if (!Number.isInteger(curriculum.sort ?? 0)) problem(`${where}: sort must be a whole number`);
  if (!Array.isArray(curriculum.levels) || curriculum.levels.length === 0) {
    problem(`${where}: a curriculum needs at least one level`);
    continue;
  }

  const levelCodes = new Map();
  const topicCodes = new Map();
  let thousand = null;

  for (const level of curriculum.levels) {
    const at = `${where} level ${level.id}`;
    claimId(level.id, at);
    if (!text(level.name)) problem(`${at}: a level needs a name`);

    if (!Number.isInteger(level.stage) || level.stage <= 0 || level.stage % 1000 === 0) {
      problem(`${at}: stage ${level.stage} must be a positive whole number, not a multiple of 1000`);
    } else {
      const block = Math.floor(level.stage / 1000);
      if (thousand === null) thousand = block;
      if (block !== thousand) {
        problem(`${at}: stage ${level.stage} is outside ${curriculum.id}'s thousand (${thousand * 1000 + 1}-${thousand * 1000 + 999})`);
      }
      if (stageOwner.has(level.stage)) problem(`${at}: stage ${level.stage} is already ${stageOwner.get(level.stage)}'s`);
      else stageOwner.set(level.stage, level.id);
    }

    const levelCode = text(level.code) ?? level.id;
    if (levelCodes.has(levelCode)) problem(`${at}: code ${levelCode} repeats level ${levelCodes.get(levelCode)}`);
    else levelCodes.set(levelCode, level.id);

    if (!Array.isArray(level.topics) || level.topics.length === 0) {
      problem(`${at}: a level needs at least one topic`);
      continue;
    }
    const numbers = new Map();
    for (const topic of level.topics) {
      const tat = `${where} topic ${topic.id}`;
      claimId(topic.id, tat);
      if (!text(topic.name)) problem(`${tat}: a topic needs a name`);
      if (!Number.isInteger(topic.number) || topic.number <= 0) problem(`${tat}: number must be a positive whole number`);
      else if (numbers.has(topic.number)) problem(`${tat}: number ${topic.number} repeats ${numbers.get(topic.number)}`);
      else numbers.set(topic.number, topic.id);

      const topicCode = text(topic.code) ?? topic.id;
      if (topicCodes.has(topicCode)) problem(`${tat}: code ${topicCode} repeats topic ${topicCodes.get(topicCode)}`);
      else topicCodes.set(topicCode, topic.id);
    }
  }

  if (thousand !== null) {
    if (thousandOwner.has(thousand)) {
      problem(`${where}: stages ${thousand * 1000 + 1}-${thousand * 1000 + 999} already belong to ${thousandOwner.get(thousand)}`);
    } else thousandOwner.set(thousand, curriculum.id);
  }
}

// ---------------------------------------------------------------------------
// The rules against what was shipped before: the previous catalog.sql
// ---------------------------------------------------------------------------

/** Every row of every INSERT in a catalog.sql, by table: [{ column: value }]. */
function parseCatalogSql(sql) {
  const rows = { curricula: [], curriculum_levels: [], curriculum_topics: [] };
  const insert = /INSERT INTO (\w+) \(([^)]*)\) VALUES/g;
  let match;
  while ((match = insert.exec(sql))) {
    const table = match[1];
    const columns = match[2].split(',').map((column) => column.trim());
    let i = insert.lastIndex;
    // Tuples until the ON CONFLICT (or the statement's end).
    for (;;) {
      while (/\s|,/.test(sql[i])) i += 1;
      if (sql[i] !== '(') break;
      i += 1;
      const values = [];
      for (;;) {
        while (sql[i] === ' ') i += 1;
        if (sql[i] === "'") {
          let value = '';
          i += 1;
          for (;;) {
            if (sql[i] === "'" && sql[i + 1] === "'") {
              value += "'";
              i += 2;
            } else if (sql[i] === "'") {
              i += 1;
              break;
            } else {
              value += sql[i];
              i += 1;
            }
          }
          values.push(value);
        } else {
          const end = sql.slice(i).search(/[,)]/);
          const raw = sql.slice(i, i + end).trim();
          values.push(raw === 'NULL' ? null : Number(raw));
          i += end;
        }
        while (sql[i] === ' ') i += 1;
        if (sql[i] === ',') {
          i += 1;
          continue;
        }
        if (sql[i] === ')') {
          i += 1;
          break;
        }
        throw new Error(`catalog.sql: cannot read the row near "${sql.slice(i, i + 40)}"`);
      }
      rows[table]?.push(Object.fromEntries(columns.map((column, k) => [column, values[k]])));
    }
    insert.lastIndex = i;
  }
  return rows;
}

const levelsNow = new Map();
const topicsNow = new Map();
for (const curriculum of curricula) {
  for (const level of curriculum.levels ?? []) {
    levelsNow.set(level.id, { ...level, curriculum_id: curriculum.id });
    for (const topic of level.topics ?? []) topicsNow.set(topic.id, { ...topic, level_id: level.id, curriculum_id: curriculum.id });
  }
}

if (existsSync(OUTPUT)) {
  const previous = parseCatalogSql(readFileSync(OUTPUT, 'utf8'));
  const curriculumOfLevel = new Map(previous.curriculum_levels.map((row) => [row.id, row.curriculum_id]));
  const waived = (curriculumId) => unreleased.has(curriculumId);

  for (const row of previous.curricula) {
    if (!curricula.some((c) => c.id === row.id) && !waived(row.id)) problem(`curriculum ${row.id} was dropped`);
  }
  for (const row of previous.curriculum_levels) {
    if (waived(row.curriculum_id)) continue;
    const now = levelsNow.get(row.id);
    if (!now) problem(`level ${row.id} was dropped (never delete a level: plans and assessments name it)`);
    else {
      if (now.stage !== row.stage) problem(`level ${row.id}: stage ${row.stage} changed to ${now.stage} (stages never change once shipped)`);
      if (now.curriculum_id !== row.curriculum_id) problem(`level ${row.id} moved from ${row.curriculum_id} to ${now.curriculum_id}`);
    }
  }
  for (const row of previous.curriculum_topics) {
    if (waived(curriculumOfLevel.get(row.level_id))) continue;
    const now = topicsNow.get(row.id);
    if (!now) problem(`topic ${row.id} was dropped (never delete a topic: ratings reference it)`);
    else {
      if (now.level_id !== row.level_id) problem(`topic ${row.id} moved from level ${row.level_id} to ${now.level_id}`);
      if (now.number !== row.number) problem(`topic ${row.id}: number ${row.number} changed to ${now.number} (add new topics with new numbers)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Write it
// ---------------------------------------------------------------------------

const sqlText = (value) => (value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const sqlInt = (value) => String(value);

function statementsFor(curriculum) {
  const out = [];
  out.push(
    `-- ${curriculum.name} (${curriculum.id}): ${curriculum.levels.length} levels, ` +
      `${curriculum.levels.reduce((sum, level) => sum + level.topics.length, 0)} topics`,
  );
  // A platform curriculum: organization_id stays NULL, and an update never
  // touches a row that has one (an organization's own, Phase D).
  out.push(
    `INSERT INTO curricula (id, name, source, edition, description, source_url, sort) VALUES\n` +
      `  (${[curriculum.id, text(curriculum.name), text(curriculum.source), text(curriculum.edition), text(curriculum.description), text(curriculum.source_url)].map(sqlText).join(', ')}, ${sqlInt(curriculum.sort ?? 0)})\n` +
      `ON CONFLICT (id) DO UPDATE SET\n` +
      `  name = excluded.name, source = excluded.source, edition = excluded.edition,\n` +
      `  description = excluded.description, source_url = excluded.source_url, sort = excluded.sort\n` +
      `  WHERE curricula.organization_id IS NULL;`,
  );
  out.push(
    `INSERT INTO curriculum_levels (id, curriculum_id, code, name, stage, grade_band, description) VALUES\n` +
      curriculum.levels
        .map(
          (level) =>
            `  (${[level.id, curriculum.id, text(level.code), text(level.name)].map(sqlText).join(', ')}, ${sqlInt(level.stage)}, ${[text(level.grade_band), text(level.description)].map(sqlText).join(', ')})`,
        )
        .join(',\n') +
      `\nON CONFLICT (id) DO UPDATE SET\n` +
      `  curriculum_id = excluded.curriculum_id, code = excluded.code, name = excluded.name,\n` +
      `  stage = excluded.stage, grade_band = excluded.grade_band, description = excluded.description;`,
  );
  // One statement per level: D1 caps a statement's size.
  for (const level of curriculum.levels) {
    out.push(
      `INSERT INTO curriculum_topics (id, level_id, number, code, unit, name, description) VALUES\n` +
        level.topics
          .map(
            (topic) =>
              `  (${[topic.id, level.id].map(sqlText).join(', ')}, ${sqlInt(topic.number)}, ${[text(topic.code), text(topic.unit), text(topic.name), text(topic.description)].map(sqlText).join(', ')})`,
          )
          .join(',\n') +
        `\nON CONFLICT (id) DO UPDATE SET\n` +
        `  level_id = excluded.level_id, number = excluded.number, code = excluded.code,\n` +
        `  unit = excluded.unit, name = excluded.name, description = excluded.description;`,
    );
  }
  return out;
}

const statements = problems.length === 0 ? curricula.flatMap(statementsFor) : [];
for (const statement of statements) {
  const bytes = Buffer.byteLength(statement);
  if (bytes > MAX_STATEMENT_BYTES) problem(`a statement is ${bytes} bytes, over D1's cap: ${statement.slice(0, 80)}`);
}

if (problems.length > 0) {
  console.error(`Refusing to write db/catalog.sql:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}

const totals = curricula
  .map((c) => `${c.id} ${c.levels.length}/${c.levels.reduce((sum, level) => sum + level.topics.length, 0)}`)
  .join(', ');

const output = `-- ===========================================================================
--  The curriculum catalog  --  GENERATED FILE, DO NOT EDIT BY HAND
-- ===========================================================================
--  From db/catalog/*.json by:  node db/generate-catalog.mjs
--  (npm run typecheck fails while this file is stale.)
--
--  The platform's curricula, as upserts: run after db/schema.sql on every new
--  database, and on its own against a live one (docs/database.md). It never
--  deletes, and never writes an organization's own curriculum.
--
--  Levels/topics: ${totals}
-- ===========================================================================

${statements.join('\n\n')}
`;

if (checkOnly) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  if (current !== output) {
    console.error('db/catalog.sql is stale: run `npm run db:catalog:generate --workspace @tmi/api`.');
    process.exit(1);
  }
  console.log(`catalog.sql is current (${totals}).`);
} else {
  writeFileSync(OUTPUT, output);
  console.log(`catalog.sql: ${totals}`);
}
