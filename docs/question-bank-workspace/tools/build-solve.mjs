// node build-solve.mjs <batch> <draft file>...  -> solve-in/<batch>-NN.json (blind: shuffled options, no key)
// and solve-key/<batch>-NN.json (ref -> draft file and index). Questions already given a ref are skipped.
import { writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { QB, readJson, standards } from './common.mjs';
const [batch, ...files] = process.argv.slice(2);
const PER = Number(process.env.PER ?? 40);
const all = standards();
const statePath = join(QB, 'logs/refs.json');
const refs = existsSync(statePath) ? readJson(statePath) : {}; // "<file>#<i>" -> ref
let seed = 0; for (const ch of batch) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const items = [];
for (const file of files) {
  const d = readJson(file);
  d.questions.forEach((q, i) => {
    const s = all.find((x) => x.id === (q.topic_id ?? d.topic_id));
    const k = `${basename(file)}#${i}`; if (refs[k]) return;
    items.push({ k, file: basename(file), i, s, q });
  });
}
// interleave topics so a solver file is not one standard
items.sort(() => rand() - 0.5);
let n = 0;
for (let c = 0; c * PER < items.length; c++) {
  const chunk = items.slice(c * PER, (c + 1) * PER);
  const name = `${batch}-${String(c + 1).padStart(2, '0')}`;
  const qs = []; const key = {};
  chunk.forEach((it, j) => {
    const ref = `${name}-${j + 1}`;
    const options = it.q.kind === 'choice' ? [...it.q.choices].sort(() => rand() - 0.5) : [];
    qs.push({ ref, standard: `${it.s.code} (${it.s.level}): ${it.s.name}. ${it.s.summary}`, question: it.q.stem, ...(options.length ? { options } : { answer_with: 'a number' }) });
    key[ref] = { file: it.file, i: it.i };
    refs[it.k] = ref; n++;
  });
  writeFileSync(join(QB, 'solve-in', `${name}.json`), JSON.stringify({ questions: qs }, null, 1));
  writeFileSync(join(QB, 'solve-key', `${name}.json`), JSON.stringify(key, null, 1));
  console.log(name, qs.length);
}
writeFileSync(statePath, JSON.stringify(refs, null, 1));
console.log('refs given', n);
