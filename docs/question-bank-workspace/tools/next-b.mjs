// node next-b.mjs [n=2]  -> the next pass-B group: writes standards/b5-*.json and context/*.json, prints the task line.
// Skips standards whose bank count is 0 (pass A not merged yet) -- they wait at the head of the queue.
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { QB, readJson, standards, bankByTopic } from './common.mjs';
const n = Number(process.argv[2] ?? 2);
const order = readJson(join(QB, 'logs/b-order.json'));
const donePath = join(QB, 'logs/b-launched.json'); const launched = existsSync(donePath) ? readJson(donePath) : [];
const all = standards(); const bank = bankByTopic();
const pick = [];
for (const t of order) { if (pick.length >= n) break; if (launched.includes(t)) continue; if (!(bank.get(t) ?? []).length) continue; pick.push(t); }
if (!pick.length) { console.log('NONE LEFT (or waiting for pass A)'); process.exit(0); }
const parts = [];
for (const t of pick) {
  const s = all.find((x) => x.id === t); const qs = bank.get(t) ?? [];
  const need = [1, 2, 3].map((d) => Math.max(0, 33 - qs.filter((q) => q.difficulty === d).length));
  writeFileSync(join(QB, 'standards', `b5-${t}.json`), JSON.stringify({ topic_id: s.id, code: s.code, name: s.name, strand: s.unit, summary: s.summary, grade: s.level }, null, 2));
  writeFileSync(join(QB, 'context', `${t}.json`), JSON.stringify({ standard: { topic_id: s.id, code: s.code, name: s.name, summary: s.summary, grade: s.level }, in_bank_by_difficulty: [1, 2, 3].map((d) => qs.filter((q) => q.difficulty === d).length),
    in_bank: qs.map((q) => ({ difficulty: q.difficulty, kind: q.kind, skill: q.skill, stem: q.stem, choices: q.choices, answer: q.answer })) }, null, 1));
  parts.push(need.join('/') === '23/23/23' ? `b5-${t}` : `b5-${t} (write ${need[0]} at difficulty 1, ${need[1]} at 2, ${need[2]} at 3)`);
  launched.push(t);
}
writeFileSync(donePath, JSON.stringify(launched));
console.log(parts.join('; '));
console.log(`launched ${launched.length}/${order.length}`);
