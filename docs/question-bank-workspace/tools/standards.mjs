// node standards.mjs <prefix> <topic>...  -> standards/<prefix>-<topic>.json (what a writer reads)
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QB, standards } from './common.mjs';
const [prefix, ...topics] = process.argv.slice(2); const all = standards();
for (const t of topics) { const s = all.find((x) => x.id === t);
  writeFileSync(join(QB, 'standards', `${prefix}-${t}.json`), JSON.stringify({ topic_id: s.id, code: s.code, name: s.name, strand: s.unit, summary: s.summary, grade: s.level }, null, 2)); }
console.log(topics.length);
