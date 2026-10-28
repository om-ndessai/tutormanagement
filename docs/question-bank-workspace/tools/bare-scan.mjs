import { readdirSync, readFileSync } from 'node:fs';
import { bareLatex } from './bare-latex.mjs';
for (const dir of process.argv.slice(2)) {
  let n = 0; const ex = {}; const files = {};
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    let d; try { d = JSON.parse(readFileSync(dir + '/' + f, 'utf8')); } catch { continue; }
    for (const q of d.questions ?? []) for (const t of [q.stem, q.solution, q.answer, ...(q.choices ?? [])]) {
      const b = bareLatex(t); if (b) { n++; ex[b] = (ex[b] ?? 0) + 1; files[f] = (files[f] ?? 0) + 1; if (n <= 8) console.log(' ', f, b, JSON.stringify((String(t).match(/\$[^$]*\$/g) ?? []).find((s) => s.includes(b)))); break; }
    }
  }
  console.log(dir, n, JSON.stringify(ex), JSON.stringify(files));
}
