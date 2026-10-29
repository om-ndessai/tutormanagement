#!/usr/bin/env node
/**
 * Loads the repository's checked questions into PRODUCTION's bank (tutoring-db), one release step:
 *
 *   1. refuses unless this is a clean checkout of main (what production runs is main);
 *   2. backs production up into ~/tmi-portal-backups/ (unless --skip-backup: the owner waives it);
 *   3. runs db/catalog.sql there -- upserts only, so new curricula and topics (Math Kangaroo's) exist
 *      before any question names them;
 *   4. writes the chosen levels' CHECKED questions as INSERTs (`generate-questions.mjs --production
 *      --levels`), refuses above the write budget, and runs them: ON CONFLICT DO NOTHING, so a question
 *      already there -- approved, edited or retired in the console -- is left alone, and re-running is safe;
 *   5. counts what production now holds at those levels (one read-only SELECT).
 *
 * It never approves anything (approving is a person's act, in the console), never deletes, and never
 * deploys: run `npm run deploy` (both production Workers) afterwards, so the code that knows the new
 * levels is what serves them.
 *
 *   npm run questions:seed:production                       Math Kangaroo's levels (MK*)
 *   npm run questions:seed:production -- --levels=MK12,MK34
 *   npm run questions:seed:production -- --dry-run          write the files and print the plan only
 *   npm run questions:seed:production -- --yes --skip-backup
 *
 * Needs `npx wrangler login` on the production account (apps/api/wrangler.jsonc pins it).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const API = join(ROOT, 'apps', 'api');
const DB = 'tutoring-db';
/** Rows written, index entries included, that one run may spend: the free plan writes 100,000 a day. */
const WRITE_BUDGET = 60000;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const levels = args.find((a) => a.startsWith('--levels='))?.slice('--levels='.length) || 'MK*';
const dryRun = flag('dry-run');
const skipBackup = flag('skip-backup');
const assumeYes = flag('yes');

const run = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, { cwd: API, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...opts });
const wrangler = (...argv) => run('npx', ['wrangler', ...argv], { stdio: 'inherit' });
const fail = (text) => {
  console.error(`seed-production-questions: ${text}`);
  process.exit(1);
};

// 1. A clean checkout of main.
const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const dirty = run('git', ['status', '--porcelain']).trim();
if (!dryRun) {
  if (branch !== 'main') fail(`this is ${branch}; production is seeded from main (merge first).`);
  if (dirty) fail('the checkout has uncommitted changes; seed from a clean checkout of main.');
}

// The levels asked for, as the question files name them.
const patterns = levels.split(',').map((p) => p.trim()).filter(Boolean);
const matches = (level) => patterns.some((p) => (p.endsWith('*') ? level.startsWith(p.slice(0, -1)) : level === p));
const levelIds = readdirSync(join(API, 'db', 'questions'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(API, 'db', 'questions', f), 'utf8')).level_id)
  .filter(matches)
  .sort();
if (levelIds.length === 0) fail(`no question file is at ${levels}.`);
if (!levelIds.every((id) => /^[A-Za-z0-9.]+$/.test(id))) fail('a level id has unexpected characters.');

// 4 (prepared first, so the plan can be shown): the INSERTs and their write estimate.
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const seedFile = join(tmpdir(), `questions-seed-${stamp}.sql`);
run('node', ['db/generate-questions.mjs', `--production=${seedFile}`, `--levels=${levels}`], { stdio: 'inherit' });
try {
  run('node', [join(ROOT, 'scripts', 'seed-budget.mjs'), `--max=${WRITE_BUDGET}`, seedFile], { stdio: 'inherit' });
} catch {
  fail(`the seed would write more than ${WRITE_BUDGET} rows; seed fewer levels at a time (--levels=...).`);
}

const backupDir = join(homedir(), 'tmi-portal-backups');
const backupFile = join(backupDir, `${DB}-${stamp}.sql`);
console.log(`
Seeding PRODUCTION (${DB}, remote) at: ${levelIds.join(', ')}
  1. backup      ${skipBackup ? 'SKIPPED (--skip-backup)' : backupFile}
  2. catalog     db/catalog.sql (upserts)
  3. questions   ${seedFile} (checked, INSERT ... ON CONFLICT DO NOTHING)
  4. count       one read-only SELECT
Then deploy both Workers yourself: npm run deploy
`);
if (dryRun) {
  console.log('Dry run: nothing was sent to production.');
  process.exit(0);
}
if (!assumeYes) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`Type ${DB} to go ahead: `);
  rl.close();
  if (answer.trim() !== DB) fail('not confirmed; nothing was sent.');
}

// 2. The backup.
if (!skipBackup) {
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  wrangler('d1', 'export', DB, '--remote', `--output=${backupFile}`);
  console.log(`seed-production-questions: backed up to ${backupFile}`);
}

// 3. The catalog, then the questions.
wrangler('d1', 'execute', DB, '--remote', '--yes', '--file=./db/catalog.sql');
wrangler('d1', 'execute', DB, '--remote', '--yes', `--file=${seedFile}`);

// 5. What production now holds there.
const list = levelIds.map((id) => `'${id}'`).join(', ');
const SQL = `SELECT t.level_id, q.status, COUNT(*) AS questions FROM questions q
JOIN curriculum_topics t ON t.id = q.topic_id WHERE t.level_id IN (${list})
GROUP BY t.level_id, q.status ORDER BY t.level_id, q.status`.replace(/\s+/g, ' ');
const rows = JSON.parse(run('npx', ['wrangler', 'd1', 'execute', DB, '--remote', '--json', `--command=${SQL}`]))[0]?.results ?? [];
console.table(rows);
console.log('seed-production-questions: done. Next: npm run deploy (both production Workers).');
