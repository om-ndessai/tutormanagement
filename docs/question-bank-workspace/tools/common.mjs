import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
/** The repository and the workspace: QB_REPO and QB_DIR override the defaults (this cloud session's paths). */
export const REPO = process.env.QB_REPO ?? '/home/user/tutormanagement';
export const QDIR = join(REPO, 'apps/api/db/questions');
export const QB = process.env.QB_DIR ?? '/tmp/claude-0/-home-user-tutormanagement/c1bd4d54-0856-5271-88a6-f5fe9338206d/scratchpad/qb';
// packages/shared/src/questions.ts bundled by esbuild (see the README):
//   npx esbuild packages/shared/src/questions.ts --bundle --format=esm --platform=node --outfile=$QB_DIR/tools/shared-questions.mjs
export const shared = await import(join(QB, 'tools/shared-questions.mjs'));
export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export function standards() {
  const cat = readJson(join(REPO, 'apps/api/db/catalog/nc-2017.json'));
  const out = [];
  for (const l of cat.levels) for (const t of l.topics) out.push({ id: t.id, code: t.code, level_id: l.id, level: l.name, unit: t.unit, name: t.name, summary: t.description });
  return out;
}
export function levelFile(level) { return join(QDIR, `${level}.json`); }
/** Every bank question on NC 2017, by topic. */
export function bankByTopic() {
  const m = new Map();
  for (const f of readdirSync(QDIR).filter((f) => f.startsWith('NC17.'))) {
    for (const q of readJson(join(QDIR, f)).questions) { if (!m.has(q.topic_id)) m.set(q.topic_id, []); m.get(q.topic_id).push(q); }
  }
  return m;
}
/** Drafts already written for a topic (not yet in the bank), from drafts/ files. */
export function draftsFor(topic) {
  const dir = join(QB, 'drafts');
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    try { const d = readJson(join(dir, f)); for (const q of d.questions ?? []) if ((q.topic_id ?? d.topic_id) === topic) out.push({ ...q, _file: f }); } catch {}
  }
  return out;
}
