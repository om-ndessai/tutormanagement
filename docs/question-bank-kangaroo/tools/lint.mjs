// node lint.mjs <draft.json>...   Lints writer drafts with the bank's own lintQuestion.
// A draft: { "topic_id": "MK12.01", "questions": [ { id, difficulty, kind, skill, stem, choices, answer, compute, solution } ] }
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { lintQuestion } from './shared.mjs';

const BANK = '/home/user/tutormanagement/apps/api/db/questions';
const bankStems = new Map(); // topic -> stems
if (existsSync(BANK)) for (const f of readdirSync(BANK).filter((f) => f.endsWith('.json'))) {
  for (const q of JSON.parse(readFileSync(join(BANK, f), 'utf8')).questions ?? []) {
    if (!bankStems.has(q.topic_id)) bankStems.set(q.topic_id, []);
    bankStems.get(q.topic_id).push(q.stem);
  }
}
let bad = 0;
for (const file of process.argv.slice(2)) {
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  const seen = [...(bankStems.get(draft.topic_id) ?? [])];
  const ids = new Set();
  const perDiff = { 1: 0, 2: 0, 3: 0 };
  let longest = 0, shortest = 0, choiceCount = 0;
  for (const q of draft.questions) {
    const problems = lintQuestion({ kind: q.kind, stem: q.stem ?? '', choices: q.choices ?? [], answer: String(q.answer ?? ''), compute: q.compute ?? null, solution: q.solution ?? '' }, seen);
    if (!q.id || ids.has(q.id)) problems.push('missing or repeated id');
    ids.add(q.id);
    if (![1, 2, 3].includes(q.difficulty)) problems.push('difficulty must be 1, 2 or 3');
    else perDiff[q.difficulty] += 1;
    if (!q.skill) problems.push('no skill');
    if (q.kind === 'choice' && (q.choices ?? []).length === 4) {
      choiceCount += 1;
      const lens = q.choices.map((c) => c.length);
      const k = q.choices.findIndex((c) => c === q.answer);
      if (k >= 0) {
        if (lens.every((l, i) => i === k || l < lens[k])) longest += 1;
        if (lens.every((l, i) => i === k || l > lens[k])) shortest += 1;
      }
    }
    if (/\b(picture|pictures|figure|diagram|shown|see below)\b/i.test(q.stem)) problems.push('refers to a picture (text only)');
    if (problems.length) { bad += 1; console.log(`${file} ${q.id}: ${problems.join(' | ')}`); }
    seen.push(q.stem);
  }
  console.log(`${file}: ${draft.questions.length} questions, by difficulty ${JSON.stringify(perDiff)}; choice ${choiceCount}, key strictly longest ${longest}, strictly shortest ${shortest}`);
}
console.log(bad ? `${bad} with problems` : 'all clean');
process.exit(bad ? 1 : 0);
