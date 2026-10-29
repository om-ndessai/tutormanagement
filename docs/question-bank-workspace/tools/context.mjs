// node context.mjs <topic>...  -> writes context/<topic>.json: the standard and its bank questions (for writers)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QB, standards, bankByTopic } from './common.mjs';
const all = standards(); const bank = bankByTopic();
for (const topic of process.argv.slice(2)) {
  const s = all.find((x) => x.id === topic); if (!s) { console.error('no topic', topic); process.exit(1); }
  const qs = (bank.get(topic) ?? []).map((q) => ({ difficulty: q.difficulty, kind: q.kind, skill: q.skill, stem: q.stem, choices: q.choices, answer: q.answer }));
  const byD = [1, 2, 3].map((d) => qs.filter((q) => q.difficulty === d).length);
  writeFileSync(join(QB, 'context', `${topic}.json`), JSON.stringify({ standard: s, in_bank_by_difficulty: byD, in_bank: qs }, null, 1));
  console.log(topic, s.code, 'in bank', qs.length, byD.join('/'));
}
