// node merge.mjs <level> <drafts dir> <solve-out dir> <bank file>
// Keeps a question only if lint is clean and the blind solver agrees and passes every judgment.
// Writes the bank file (ids stable via the map file beside it) and prints the flagged.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lintQuestion, checkAnswer } from './shared.mjs';
const [level, draftsDir, solveDir, bankFile, mapFile, source, notesFile] = process.argv.slice(2);
const verdicts = new Map();
// Repair verdicts load last, in order, so a re-solve always outranks the first solve.
const rank = (f) => (f.includes('repair') ? 1 : 0);
for (const f of readdirSync(solveDir).filter((f) => f.endsWith('.json')).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1))) {
  for (const v of JSON.parse(readFileSync(join(solveDir, f), 'utf8'))) verdicts.set(v.id, v); // later files win (re-solves)
}
const idMap = existsSync(mapFile) ? JSON.parse(readFileSync(mapFile, 'utf8')) : {};
const kept = [], flagged = [], unsolved = [];
const stems = new Map();
const at = new Date().toISOString();
for (const f of readdirSync(draftsDir).filter((f) => f.startsWith(level + '.') && f.endsWith('.json')).sort()) {
  const draft = JSON.parse(readFileSync(join(draftsDir, f), 'utf8'));
  for (const q of draft.questions) {
    const content = { kind: q.kind, stem: q.stem, choices: q.choices ?? [], answer: String(q.answer), compute: q.compute ?? null, solution: q.solution };
    const others = stems.get(draft.topic_id) ?? [];
    const lint = lintQuestion(content, others);
    const v = verdicts.get(q.id);
    if (!v) { unsolved.push(q.id); continue; }
    const agreed = checkAnswer({ kind: q.kind, answer: String(q.answer) }, String(v.answer ?? ''));
    const ok = lint.length === 0 && agreed && v.single_answer && v.aligned && v.grade_appropriate && v.error_free;
    if (!ok) { flagged.push({ id: q.id, topic_id: draft.topic_id, difficulty: q.difficulty, key: q.answer, solver: v.answer, lint, single_answer: v.single_answer, aligned: v.aligned, grade_appropriate: v.grade_appropriate, error_free: v.error_free, issues: v.issues, stem: q.stem }); continue; }
    others.push(q.stem); stems.set(draft.topic_id, others);
    idMap[q.id] ??= randomUUID();
    kept.push({
      id: idMap[q.id], topic_id: draft.topic_id, difficulty: q.difficulty, kind: q.kind, skill: q.skill, stem: q.stem,
      choices: q.choices ?? [], answer: String(q.answer), compute: q.compute ?? null, solution: q.solution, status: 'checked', source: 'ai',
      checks: { lint: [], solve: { answer: String(v.answer), agreed: true, single_answer: true, aligned: true, grade_appropriate: true, error_free: true, issues: v.issues ?? '', work: v.work ?? '', run_id: 'claude-code', at } },
    });
  }
}
writeFileSync(mapFile, JSON.stringify(idMap, null, 1));
const notes = notesFile && existsSync(notesFile) ? JSON.parse(readFileSync(notesFile, 'utf8')) : {};
writeFileSync(bankFile, JSON.stringify({ level_id: level, source, notes, questions: kept }, null, 2) + '\n');
writeFileSync(join(solveDir, '..', `flagged-${level}.json`), JSON.stringify(flagged, null, 1));
const byTopic = {};
for (const q of kept) byTopic[q.topic_id] = (byTopic[q.topic_id] ?? 0) + 1;
console.log(`kept ${kept.length}, flagged ${flagged.length}, unsolved ${unsolved.length}`, byTopic);
