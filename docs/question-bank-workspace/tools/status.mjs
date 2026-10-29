// node status.mjs: NC 2017 bank counts, and the pipeline's state.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { QB, readJson, standards, bankByTopic } from './common.mjs';
const bank = bankByTopic(); const all = standards();
const dist = {}; let total = 0;
for (const s of all) { const n = (bank.get(s.id) ?? []).length; total += n; const b = n === 0 ? '0' : n < 30 ? '1-29' : n < 90 ? '30-89' : '90+'; dist[b] = (dist[b] ?? 0) + 1; }
console.log('NC17 questions', total, 'standards by count', dist);
const solveIn = readdirSync(join(QB, 'solve-in')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
const unsolved = solveIn.filter((c) => !existsSync(join(QB, 'solve-out', c + '.json')));
const merged = existsSync(join(QB, 'logs/merged.json')) ? readJson(join(QB, 'logs/merged.json')) : {};
const unmerged = solveIn.filter((c) => existsSync(join(QB, 'solve-out', c + '.json')) && Object.keys(readJson(join(QB, 'solve-key', c + '.json'))).some((r) => !merged[r]));
console.log('solve chunks', solveIn.length, 'unsolved', unsolved.join(' ') || '-', '| solved but not merged', unmerged.join(' ') || '-');
const queue = existsSync(join(QB, 'repair/queue.jsonl')) ? require_lines(join(QB, 'repair/queue.jsonl')) : [];
function require_lines(p) { return (readFileSync(p, 'utf8').trim().split('\n').filter(Boolean)); }
import { readFileSync } from 'node:fs';
console.log('repair queue', queue.length);
