// node ctrl-scan.mjs <json files>  : questions whose text holds a control character (a lost LaTeX backslash).
import { readFileSync } from 'node:fs';
const bad = /[\x00-\x09\x0b-\x1f]|\n(?=eq|e\b|e |u\b|abla|ot|eg|i\b)/;
let total = 0;
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(f, 'utf8')); let n = 0;
  for (const q of d.questions) { const t = [q.stem, q.solution, q.answer, ...(q.choices ?? [])].join(' | '); if (bad.test(t)) { n++; if (n <= 2) console.log('  ', f.split('/').pop(), JSON.stringify(t.match(/.{0,12}([\x00-\x09\x0b-\x1f]|\n).{0,8}/)[0])); } }
  if (n) console.log(f.split('/').pop(), n); total += n;
}
console.log('total', total);
