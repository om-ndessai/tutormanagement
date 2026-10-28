// node plan-b.mjs -> logs/b-order.json: every NC 2017 standard short of 99, round robin over the 14 levels.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QB, standards, bankByTopic } from './common.mjs';
const NEW = new Set(process.argv.slice(2));
const all = standards(); const bank = bankByTopic();
const byLevel = new Map();
for (const s of all) { const n = (bank.get(s.id) ?? []).length; if (n >= 97 && !NEW.has(s.id)) continue;
  if (!byLevel.has(s.level_id)) byLevel.set(s.level_id, []); byLevel.get(s.level_id).push(s.id); }
const order = []; const lists = [...byLevel.values()];
for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) order.push(l[i]);
writeFileSync(join(QB, 'logs/b-order.json'), JSON.stringify(order, null, 0));
console.log(order.length, 'standards;', order.slice(0, 16).join(' '));
