#!/usr/bin/env node
/**
 * The question bank's approved and checked questions, for local and demo builds (Phase 36).
 *
 *   db/questions/<level>.json  ->  db/questions.sql
 *
 * Production's bank is written and approved in production's console; it is the
 * source, and this file never reaches it. `npm run questions:export` copies its
 * approved and checked questions here (read-only), so the local suite and the
 * demo test against the real bank. The files began as 12 hand-written approved
 * questions (4.ANR.1-2) and the bank's first 2026-10-17 writing, all `checked`.
 *
 * `--production=<file>` writes the CHECKED questions alone as INSERTs for
 * production instead (no reviewer: approving is a person's act in that
 * database, in its console). That is how the first writing reached production;
 * run it on production only within an approved release, after the backup.
 *
 * Loaded AFTER db/platform-admin.sql (`db:reset`, `db:reset:test`, scripts/e2e.sh):
 * an approved question names its reviewer, and here that is the platform admin
 * that file creates. Inserts only (ON CONFLICT DO NOTHING), never a DELETE.
 *
 * Refuses an id used twice, a topic outside the bank's levels, and a question
 * missing what the table requires. The code checks (lintQuestion) run on every
 * file in e2e/tests/question-bank.spec.ts, since they live in TypeScript.
 *
 * Phase 49: it also writes db/questions-sample.sql, which `db:reset` and the demo load instead.
 * All 30,000 questions are about 150,000 rows written (the primary key and three indexes), over
 * the free plan's 100,000 a day, so the demo could not be reseeded in a day. The sample keeps
 * every approved question and up to SAMPLE_PER_TOPIC checked ones per standard, spread over the
 * difficulties, sorted by id so it is the same every time, and refuses a level left with fewer
 * than SAMPLE_LEVEL_MIN. `db:reset:full` loads the whole bank.
 *
 *   node db/generate-questions.mjs           write db/questions.sql and db/questions-sample.sql
 *   node db/generate-questions.mjs --check   fail if either is stale (npm run typecheck)
 *   node db/generate-questions.mjs --production=<file>
 *   node db/generate-questions.mjs --production=<file> --levels=MK12,MK34   only these levels
 *   node db/generate-questions.mjs --production=<file> --levels=MK*         every level starting MK
 *
 * `npm run questions:seed:production` (scripts/seed-production-questions.mjs) runs the
 * production path end to end: backup, catalog, these INSERTs, and a read-only count.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(here, 'questions');
const OUTPUT = join(here, 'questions.sql');
const SAMPLE_OUTPUT = join(here, 'questions-sample.sql');
/** Checked questions kept per standard in the sample, round robin over difficulties 1-3. */
const SAMPLE_PER_TOPIC = 8;
/**
 * The fewest questions a level may hold in the sample. The suite's needs: a 25-question assessment,
 * Quest Games' count games and their climb into the level above, Phase 48's curated series running
 * out of unseen questions, and a level Quest can move a student through.
 */
const SAMPLE_LEVEL_MIN = 50;
/** db/platform-admin.sql's platform admin. */
const REVIEWER = '0c000000-0000-4000-8000-000000000001';
/** packages/shared/src/questions.ts, QUESTION_BANK_LEVEL_IDS. */
const LEVELS = new Set([
  ...['NC26.K', 'NC26.1', 'NC26.2', 'NC26.3', 'NC26.4', 'NC26.5', 'NC26.6', 'NC26.7', 'NC26.8', 'NC26.M1'],
  ...['NC26.M2', 'NC26.ALR', 'NC26.ASDS', 'NC26.MSM'],
  ...['NC17.K', 'NC17.1', 'NC17.2', 'NC17.3', 'NC17.4', 'NC17.5', 'NC17.6', 'NC17.7', 'NC17.8'],
  ...['NC17.M1', 'NC17.M2', 'NC17.M3', 'NC17.M4', 'NC17.PC'],
  ...['BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO'],
  ...['MK12', 'MK34', 'MK56', 'MK78', 'MK910', 'MK1112'],
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const checkOnly = process.argv.includes('--check');
const production = process.argv.find((arg) => arg.startsWith('--production='))?.slice('--production='.length);
/** `--levels=MK12,MK34` or `--levels=MK*`: only these levels (production files only). */
const levelsArg = process.argv.find((arg) => arg.startsWith('--levels='))?.slice('--levels='.length);
const levelPatterns = levelsArg ? levelsArg.split(',').map((p) => p.trim()).filter(Boolean) : null;
const wantLevel = (level) =>
  !levelPatterns || levelPatterns.some((p) => (p.endsWith('*') ? level.startsWith(p.slice(0, -1)) : level === p));
if (levelPatterns && !production) {
  console.error('generate-questions: --levels works only with --production (the local files always hold the whole bank).');
  process.exit(1);
}
const problems = [];
const seen = new Set();

const sql = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);

const files = existsSync(SOURCES) ? readdirSync(SOURCES).filter((f) => f.endsWith('.json')).sort() : [];
const statements = [];
/** Per question: its statement, level, topic, difficulty, status and id, for the sample. */
const entries = [];
for (const file of files) {
  const source = JSON.parse(readFileSync(join(SOURCES, file), 'utf8'));
  if (!LEVELS.has(source.level_id)) problems.push(`${file}: ${source.level_id} is not a level the bank covers.`);
  for (const q of source.questions ?? []) {
    const where = `${file} ${q.id}`;
    if (!UUID.test(q.id ?? '')) problems.push(`${where}: the id is not a UUID.`);
    if (seen.has(q.id)) problems.push(`${where}: the id is used twice.`);
    seen.add(q.id);
    if (!String(q.topic_id ?? '').startsWith(`${source.level_id}.`)) problems.push(`${where}: its topic is not in ${source.level_id}.`);
    if (![1, 2, 3].includes(q.difficulty)) problems.push(`${where}: difficulty must be 1, 2 or 3.`);
    if (!['choice', 'numeric'].includes(q.kind)) problems.push(`${where}: kind must be choice or numeric.`);
    if (!['approved', 'checked'].includes(q.status)) problems.push(`${where}: only approved or checked questions are kept here.`);
    for (const field of ['stem', 'answer', 'solution']) {
      if (!String(q[field] ?? '').trim()) problems.push(`${where}: ${field} is empty.`);
    }
    const approved = q.status === 'approved';
    if (production && approved) continue;
    if (production && !wantLevel(source.level_id)) continue;
    const statement =
      `INSERT INTO questions (id, topic_id, difficulty, kind, skill, stem, choices, answer, compute, solution, status, checks, source, reviewed_by, reviewed_at)
VALUES (${[
        sql(q.id),
        sql(q.topic_id),
        q.difficulty,
        sql(q.kind),
        sql(q.skill ?? null),
        sql(q.stem),
        sql(JSON.stringify(q.choices ?? [])),
        sql(q.answer),
        sql(q.compute ?? null),
        sql(q.solution),
        sql(q.status),
        sql(JSON.stringify(q.checks ?? { lint: [], solve: null })),
        sql(q.source ?? 'manual'),
        approved ? sql(REVIEWER) : 'NULL',
        approved ? sql(q.reviewed_at ?? '2026-10-17T00:00:00.000Z') : 'NULL',
      ].join(', ')})
ON CONFLICT (id) DO NOTHING;`;
    statements.push(statement);
    entries.push({ statement, level: source.level_id, topic: q.topic_id, difficulty: q.difficulty, status: q.status, id: q.id });
  }
}

/** The sample: every approved question, and up to SAMPLE_PER_TOPIC checked ones per standard. */
function sampleOf(all) {
  const byTopic = new Map();
  for (const e of all) {
    if (!byTopic.has(e.topic)) byTopic.set(e.topic, []);
    byTopic.get(e.topic).push(e);
  }
  const kept = new Set();
  for (const list of byTopic.values()) {
    for (const e of list) if (e.status === 'approved') kept.add(e);
    const queues = [1, 2, 3].map((d) =>
      list.filter((e) => e.status === 'checked' && e.difficulty === d).sort((a, b) => (a.id < b.id ? -1 : 1)),
    );
    let taken = 0;
    while (taken < SAMPLE_PER_TOPIC && queues.some((qq) => qq.length > 0)) {
      for (const qq of queues) {
        if (taken >= SAMPLE_PER_TOPIC) break;
        const next = qq.shift();
        if (next) { kept.add(next); taken += 1; }
      }
    }
  }
  // In the full file's order, so the two files read alike.
  const sample = all.filter((e) => kept.has(e));
  const perLevel = new Map();
  for (const e of sample) perLevel.set(e.level, (perLevel.get(e.level) ?? 0) + 1);
  for (const level of new Set(all.map((e) => e.level))) {
    const n = perLevel.get(level) ?? 0;
    if (n < SAMPLE_LEVEL_MIN) problems.push(`the sample holds ${n} questions at ${level}, fewer than ${SAMPLE_LEVEL_MIN}.`);
  }
  return sample;
}
const sample = production ? [] : sampleOf(entries);

if (problems.length > 0) {
  console.error('generate-questions: refusing --');
  for (const text of problems) console.error(`  ${text}`);
  process.exit(1);
}

const output = `-- GENERATED by db/generate-questions.mjs from db/questions/*.json. Do not edit.
-- The question bank's approved questions for local and demo builds; never run on
-- production, whose console is the source. Load after db/platform-admin.sql.
${statements.join('\n')}
`;
const sampleOutput = `-- GENERATED by db/generate-questions.mjs from db/questions/*.json. Do not edit.
-- A SAMPLE of the question bank for local and demo builds (Phase 49): every approved question and up
-- to ${SAMPLE_PER_TOPIC} checked ones per standard. db/questions.sql is the whole bank (db:reset:full).
-- Never run on production. Load after db/platform-admin.sql.
${sample.map((e) => e.statement).join('\n')}
`;

if (production) {
  writeFileSync(
    production,
    `-- GENERATED by db/generate-questions.mjs --production from db/questions/*.json: the CHECKED
-- questions, for production's bank. Inserts only; a question already there is left alone.
${statements.join('\n')}
`,
  );
  if (levelPatterns && statements.length === 0) {
    console.error(`generate-questions: no checked questions at ${levelPatterns.join(', ')}.`);
    process.exit(1);
  }
  console.log(`generate-questions: wrote ${statements.length} checked questions to ${production}.`);
} else if (checkOnly) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  const currentSample = existsSync(SAMPLE_OUTPUT) ? readFileSync(SAMPLE_OUTPUT, 'utf8') : '';
  if (current !== output || currentSample !== sampleOutput) {
    console.error(
      'generate-questions: db/questions.sql or db/questions-sample.sql is stale. Run `npm run db:questions:generate --workspace @tmi/api`.',
    );
    process.exit(1);
  }
  console.log(`generate-questions: questions.sql (${statements.length}) and the sample (${sample.length}) are current.`);
} else {
  writeFileSync(OUTPUT, output);
  writeFileSync(SAMPLE_OUTPUT, sampleOutput);
  console.log(`generate-questions: wrote ${statements.length} questions to db/questions.sql, ${sample.length} to db/questions-sample.sql.`);
}
