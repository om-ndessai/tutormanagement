// node merge.mjs <chunk>...  Reads solve-out/<chunk>.json, keeps the questions the blind solve passed (into the
import { bareLatex } from './bare-latex.mjs';
// repo's NC17.<level>.json as `checked`), queues the rest in repair/queue.jsonl. Idempotent per ref (logs/merged.json).
import { writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { QB, readJson, shared, levelFile, bankByTopic, standards } from './common.mjs';
const statePath = join(QB, 'logs/merged.json');
const state = existsSync(statePath) ? readJson(statePath) : {};
const all = standards();
const levelDocs = new Map();
const doc = (level) => { if (!levelDocs.has(level)) levelDocs.set(level, readJson(levelFile(level))); return levelDocs.get(level); };
const bank = bankByTopic();
const stems = (topic) => { if (!bank.has(topic)) bank.set(topic, []); return bank.get(topic); };
let kept = 0, queued = 0, missing = 0;
for (const chunk of process.argv.slice(2)) {
  const outPath = join(QB, 'solve-out', `${chunk}.json`);
  if (!existsSync(outPath)) { console.log(chunk, 'no solve-out yet'); continue; }
  const key = readJson(join(QB, 'solve-key', `${chunk}.json`));
  const out = readJson(outPath); const results = new Map((out.results ?? out).map((r) => [r.ref, r]));
  for (const [ref, loc] of Object.entries(key)) {
    if (state[ref]) continue;
    const d = readJson(join(QB, 'drafts', loc.file)); const q = d.questions[loc.i]; const topic = q.topic_id ?? d.topic_id;
    const v = results.get(ref);
    if (!v) { missing++; console.log('no verdict for', ref); continue; }
    const agreed = shared.checkAnswer({ kind: q.kind, answer: q.answer }, String(v.final_answer ?? ''));
    const pass = agreed && v.single_answer && v.aligned && v.grade_appropriate && v.error_free;
    const issues = String(v.issues ?? '').trim();
    const level = all.find((s) => s.id === topic).level_id;
    if (pass && !issues) {
      const content = { kind: q.kind, stem: q.stem, choices: q.choices ?? [], answer: q.answer, compute: q.compute || null, solution: q.solution };
      const lint = shared.lintQuestion(content, stems(topic).map((x) => x.stem));
      if ([q.stem, q.solution, q.answer, ...(q.choices ?? [])].some((t) => bareLatex(t))) lint.push('LaTeX command without its backslash');
      if ([q.stem, q.solution, q.answer, ...(q.choices ?? [])].some((t) => /[\x00-\x09\x0b-\x1f]/.test(String(t)))) lint.push('control character in text');
      if (lint.length) { appendFileSync(join(QB, 'repair/queue.jsonl'), JSON.stringify({ ref, file: loc.file, i: loc.i, topic_id: topic, q, why: 'lint at merge: ' + lint.join('; '), verdict: v }) + '\n'); state[ref] = 'queued'; queued++; continue; }
      const row = {
        id: randomUUID(), topic_id: topic, difficulty: q.difficulty, kind: q.kind, skill: q.skill, stem: q.stem,
        choices: q.choices ?? [], answer: q.answer, compute: q.compute || null, solution: q.solution, status: 'checked', source: 'ai',
        checks: { lint: [], solve: { answer: String(v.final_answer), agreed: true, single_answer: true, aligned: true, grade_appropriate: true, error_free: true, issues: '', work: String(v.work ?? '').slice(0, 2000), run_id: 'claude-code', at: new Date().toISOString() } },
      };
      doc(level).questions.push(row); stems(topic).push(row);
      const note = String((d.notes ?? {})[topic] ?? '').trim();
      if (note) { const notes = (doc(level).notes ??= {}); const prev = notes[topic];
        if (!prev) notes[topic] = note; else if (!prev.includes(note)) notes[topic] = `${prev} ${note}`; }
      state[ref] = row.id; kept++;
    } else {
      const why = !agreed ? `blind solve answered ${v.final_answer}` : !pass ? 'solver judged it faulty' : 'passed with a note';
      appendFileSync(join(QB, 'repair/queue.jsonl'), JSON.stringify({ ref, file: loc.file, i: loc.i, topic_id: topic, q, why, verdict: v }) + '\n');
      state[ref] = 'queued'; queued++;
    }
  }
}
for (const [level, d] of levelDocs) writeFileSync(levelFile(level), JSON.stringify(d, null, 2) + '\n');
writeFileSync(statePath, JSON.stringify(state, null, 1));
console.log(`kept ${kept}, queued for repair ${queued}, missing verdicts ${missing}`);
