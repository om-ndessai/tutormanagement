#!/usr/bin/env node
/**
 * Copies production's approved questions into the repository (Phase 36):
 *
 *   tutoring-db (remote, read-only)  ->  apps/api/db/questions/<level>.json  ->  db/questions.sql
 *
 * Production's console is where the bank is written and approved; this brings
 * that bank to the local suite and the demo. One SELECT, a few hundred rows read
 * -- run it after a review session, not in a loop. A level with no approved
 * question in production keeps its file (the hand-written fixture, at first).
 *
 *   npm run questions:export
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const API = new URL('../apps/api/', import.meta.url).pathname;
const SQL = `SELECT q.id, q.topic_id, t.level_id, q.difficulty, q.kind, q.skill, q.stem, q.choices,
  q.answer, q.compute, q.solution, q.status, q.checks, q.source, q.reviewed_at
FROM questions q JOIN curriculum_topics t ON t.id = q.topic_id
WHERE q.status = 'approved'
ORDER BY t.level_id, q.topic_id, q.difficulty, q.created_at`.replace(/\s+/g, ' ');

const raw = execFileSync(
  'npx',
  ['wrangler', 'd1', 'execute', 'tutoring-db', '--remote', '--json', `--command=${SQL}`],
  { cwd: API, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
const rows = JSON.parse(raw)[0]?.results ?? [];

const byLevel = new Map();
for (const row of rows) {
  const list = byLevel.get(row.level_id) ?? [];
  list.push({
    id: row.id,
    topic_id: row.topic_id,
    difficulty: row.difficulty,
    kind: row.kind,
    skill: row.skill,
    stem: row.stem,
    choices: JSON.parse(row.choices),
    answer: row.answer,
    compute: row.compute,
    solution: row.solution,
    status: row.status,
    checks: JSON.parse(row.checks),
    source: row.source,
    reviewed_at: row.reviewed_at,
  });
  byLevel.set(row.level_id, list);
}

const exportedAt = new Date().toISOString();
for (const [level, questions] of byLevel) {
  const file = join(API, 'db', 'questions', `${level}.json`);
  writeFileSync(
    file,
    `${JSON.stringify({ level_id: level, source: `production, exported ${exportedAt}`, questions }, null, 2)}\n`,
  );
  console.log(`export-questions: ${questions.length} approved questions -> db/questions/${level}.json`);
}
if (byLevel.size === 0) console.log('export-questions: production has no approved questions yet.');

execFileSync('node', ['db/generate-questions.mjs'], { cwd: API, stdio: 'inherit' });
