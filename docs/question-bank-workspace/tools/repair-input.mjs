// node repair-input.mjs <prefix> [per=20]: unassigned entries of repair/queue.jsonl -> repair/<prefix>-<i>.json
// Entries flagged only for a lost LaTeX backslash (tab) are re-solved instead: their refs are released so
// build-solve gives the (fixed) draft question a new ref.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { QB, readJson, standards, bankByTopic } from './common.mjs';
const [prefix, perArg] = process.argv.slice(2); const per = Number(perArg ?? 20);
const assignedPath = join(QB, 'logs/repair-assigned.json'); const assigned = existsSync(assignedPath) ? readJson(assignedPath) : {};
const refsPath = join(QB, 'logs/refs.json'); const refs = readJson(refsPath);
const mergedPath = join(QB, 'logs/merged.json'); const merged = readJson(mergedPath);
const all = standards(); const bank = bankByTopic();
const entries = readFileSync(join(QB, 'repair/queue.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse).filter((e) => !assigned[e.ref]);
const resolve = [], rewrite = [];
for (const e of entries) {
  const issues = String(e.verdict?.issues ?? '');
  const tabOnly = /\btab\b|TAB|mis-escaped|escape|backslash/.test(issues) && e.verdict.single_answer && e.verdict.aligned && e.verdict.grade_appropriate;
  if (tabOnly) resolve.push(e); else rewrite.push(e);
}
for (const e of resolve) { delete refs[`${e.file}#${e.i}`]; merged[e.ref] = 're-solve'; assigned[e.ref] = 're-solve'; }
let n = 0;
for (let i = 0; i * per < rewrite.length; i++) {
  const part = `${prefix}-${i + 1}`; const chunk = rewrite.slice(i * per, (i + 1) * per);
  const out = chunk.map((e) => { const s = all.find((x) => x.id === e.topic_id);
    return { topic_id: e.topic_id, standard: { code: s.code, name: s.name, covers: s.summary, grade: s.level }, difficulty: e.q.difficulty,
      flagged: { kind: e.q.kind, stem: e.q.stem, choices: e.q.choices, answer: e.q.answer, solution: e.q.solution },
      why: e.why, solve: { answer: e.verdict.final_answer, issues: e.verdict.issues, single_answer: e.verdict.single_answer, aligned: e.verdict.aligned, grade_appropriate: e.verdict.grade_appropriate, error_free: e.verdict.error_free },
      existing_stems: (bank.get(e.topic_id) ?? []).map((q) => q.stem) }; });
  writeFileSync(join(QB, 'repair', `${part}.json`), JSON.stringify({ part, entries: out }, null, 1));
  for (const e of chunk) assigned[e.ref] = part; n++; console.log(part, chunk.length);
}
writeFileSync(assignedPath, JSON.stringify(assigned, null, 1)); writeFileSync(refsPath, JSON.stringify(refs, null, 1)); writeFileSync(mergedPath, JSON.stringify(merged, null, 1));
console.log(`re-solve ${resolve.length}, repair parts ${n}`);
