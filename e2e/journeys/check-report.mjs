#!/usr/bin/env node
/**
 * The UI journey audit's report check (docs/userjourney/README.md), beside the plugin's validate_report.py:
 * every image a report embeds exists under docs/userjourney/assets/, and its Walkthrough has one
 * "### Step <n>" per phone screenshot cuj-<id>-step-<n>.png of that journey.
 *
 *   node e2e/journeys/check-report.mjs docs/userjourney/J01-adult-player.md [<id>]
 *
 * The journey id defaults to the file name's first part (J01-... -> j01).
 */
import fs from 'node:fs';
import path from 'node:path';

const [file, idArg] = process.argv.slice(2);
if (!file) {
  console.error('usage: check-report.mjs <report.md> [<id>]');
  process.exit(2);
}
const report = path.resolve(file);
const dir = path.dirname(report);
const id = (idArg ?? path.basename(report).split('-')[0]).toLowerCase();
const text = fs.readFileSync(report, 'utf8');
const problems = [];

const images = [...text.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1].trim());
for (const image of new Set(images)) {
  if (!fs.existsSync(path.join(dir, image))) problems.push(`missing image: ${image}`);
}

const walkthrough = text.split(/^## Walkthrough\s*$/m)[1]?.split(/^## /m)[0] ?? '';
const steps = [...walkthrough.matchAll(/^### Step (\d+)\b/gm)].map((m) => Number(m[1]));
const shots = fs
  .readdirSync(path.join(dir, 'assets'))
  .map((name) => new RegExp(`^cuj-${id}-step-(\\d+)\\.png$`).exec(name))
  .filter(Boolean)
  .map((m) => Number(m[1]))
  .sort((a, b) => a - b);
const stepSet = new Set(steps);
for (const n of shots) if (!stepSet.has(n)) problems.push(`screenshot cuj-${id}-step-${n}.png has no "### Step ${n}" in the Walkthrough`);
for (const n of steps) if (!shots.includes(n)) problems.push(`"### Step ${n}" has no screenshot cuj-${id}-step-${n}.png`);
if (!steps.length) problems.push('no "### Step <n>" headings under "## Walkthrough"');

if (problems.length) {
  console.error(`INVALID: ${file}\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`ok: ${file} -- ${images.length} images, ${steps.length} steps, ${shots.length} phone screenshots`);
