// The e2e spec's check: every question in db/questions passes lintQuestion against the rest of its standard; plus control chars.
import { bareLatex } from './bare-latex.mjs';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { QDIR, readJson, shared } from './common.mjs';
let bad = 0, n = 0;
for (const f of readdirSync(QDIR).filter((f) => f.startsWith(process.argv[2] ?? 'NC17.'))) {
  const qs = readJson(join(QDIR, f)).questions; const by = new Map();
  for (const q of qs) { if (!by.has(q.topic_id)) by.set(q.topic_id, []); by.get(q.topic_id).push(q); }
  for (const q of qs) { n++;
    const others = by.get(q.topic_id).filter((o) => o.id !== q.id).map((o) => o.stem);
    const p = shared.lintQuestion(q, others);
    if ([q.stem, q.solution, q.answer, ...q.choices].some((t) => bareLatex(t))) p.push('bare LaTeX');
    if ([q.stem, q.solution, q.answer, ...q.choices].some((t) => /[\x00-\x09\x0b-\x1f]/.test(t))) p.push('control char');
    if (p.length) { bad++; console.log(f, q.id, q.topic_id, p.join('; ')); }
  }
}
console.log(`${n} checked, ${bad} failing`);
