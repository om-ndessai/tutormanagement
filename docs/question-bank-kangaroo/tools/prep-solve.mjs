// node prep-solve.mjs <out.json> <draft.json>...  The blind solver's input: no key, no solution, options shuffled.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
const [out, ...files] = process.argv.slice(2);
let seed = 12345;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const items = [];
// The topic's description goes with its name, so the solver judges alignment against what the topic covers.
const describe = (draftFile, topicId) => {
  const levels = join(dirname(draftFile), '..', 'levels.json');
  if (!existsSync(levels)) return null;
  const level = JSON.parse(readFileSync(levels, 'utf8'))[topicId.split('.')[0]];
  return level?.topics.find((t) => t.id === topicId)?.description ?? null;
};
for (const file of files) {
  const draft = JSON.parse(readFileSync(file, 'utf8'));
  for (const q of draft.questions) {
    const choices = [...(q.choices ?? [])];
    for (let i = choices.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [choices[i], choices[j]] = [choices[j], choices[i]]; }
    const about = describe(file, draft.topic_id);
    items.push({ id: q.id, topic_id: draft.topic_id, topic_name: [draft.topic_name, about && `the topic covers: ${about}`].filter(Boolean).join(' -- '), kind: q.kind, stem: q.stem, choices });
  }
}
writeFileSync(out, JSON.stringify(items, null, 1));
console.log(`${out}: ${items.length} questions`);
