// node ready.mjs: draft files with questions not yet given a solve ref, whose lint is clean (complete writers only).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { QB, readJson } from './common.mjs';
const refs = readJson(join(QB, 'logs/refs.json'));
const out = [];
for (const f of readdirSync(join(QB, 'drafts')).filter((f) => f.endsWith('.json'))) {
  let d; try { d = readJson(join(QB, 'drafts', f)); } catch { continue; }
  if (!d.questions?.length || d.questions.every((_, i) => refs[`${f}#${i}`])) continue;
  try { execFileSync('node', [join(QB, 'tools/lint.mjs'), join(QB, 'drafts', f)], { stdio: 'pipe' }); out.push(join('drafts', f)); }
  catch { console.error('not clean (writer still working?):', f); }
}
console.log(out.join(' '));
