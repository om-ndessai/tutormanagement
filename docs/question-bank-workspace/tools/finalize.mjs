// node finalize.mjs: sort NC17 level files by catalog position then difficulty (stable), regenerate db/questions*.sql.
import { writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO, QDIR, readJson, standards } from './common.mjs';
const pos = new Map(standards().map((s, i) => [s.id, i]));
for (const f of readdirSync(QDIR).filter((f) => f.startsWith('NC17.'))) {
  const d = readJson(join(QDIR, f));
  d.questions = d.questions.map((q, i) => [q, i]).sort((a, b) => pos.get(a[0].topic_id) - pos.get(b[0].topic_id) || a[0].difficulty - b[0].difficulty || a[1] - b[1]).map(([q]) => q);
  if (d.notes) d.notes = Object.fromEntries(Object.entries(d.notes).sort((a, b) => pos.get(a[0]) - pos.get(b[0])));
  writeFileSync(join(QDIR, f), JSON.stringify(d, null, 2) + '\n');
}
console.log(execFileSync('node', ['apps/api/db/generate-questions.mjs'], { cwd: REPO, encoding: 'utf8' }).trim());
