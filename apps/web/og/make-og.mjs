#!/usr/bin/env node
/**
 * Phase 56: the preview pictures a shared Quest link unfurls with (1200x630), one per kind of share
 * and one for a share that is gone. Static -- a per-share picture waits for Workers Paid's CPU.
 * Regenerate with `node apps/web/og/make-og.mjs` (needs rsvg-convert: `brew install librsvg`);
 * the PNGs in apps/web/public/og/ are committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'og');
mkdirSync(out, { recursive: true });

const CARDS = {
  game_result: { title: 'Quest Game', line: 'How did your team do?', marks: ['r', 'r', 'w', 'r', 'r', 'r', 's', 'r', 'r', 'r'] },
  level_finished: { title: 'Level finished', line: 'One question at a time.', marks: ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'] },
  challenge: { title: 'Can you solve this?', line: 'One question. One answer.', marks: [] },
  quest: { title: 'Aimtrue Quest', line: 'Maths practice, one question at a time.', marks: [] },
};
const FILL = { r: '#22a06b', w: '#e5484d', s: '#d0d4dc' };

for (const [name, card] of Object.entries(CARDS)) {
  const squares = card.marks
    .map((m, i) => `<rect x="${120 + i * 92}" y="400" width="72" height="72" rx="12" fill="${FILL[m]}"/>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b2a7a"/><stop offset="1" stop-color="#6d4fd6"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1060" cy="120" r="70" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="14"/>
  <circle cx="1060" cy="120" r="30" fill="#ffffff" fill-opacity="0.35"/>
  <text x="120" y="150" font-family="Helvetica, Arial, sans-serif" font-size="40" fill="#ffffff" fill-opacity="0.8">Aimtrue Quest</text>
  <text x="120" y="270" font-family="Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#ffffff">${card.title}</text>
  <text x="120" y="345" font-family="Helvetica, Arial, sans-serif" font-size="44" fill="#ffffff" fill-opacity="0.85">${card.line}</text>
  ${squares}
</svg>`;
  const svgPath = join(here, `${name}.svg`);
  writeFileSync(svgPath, svg);
  execFileSync('rsvg-convert', ['-w', '1200', '-h', '630', '-o', join(out, `${name}.png`), svgPath]);
}
console.log(`og: ${Object.keys(CARDS).length} pictures in ${out}`);
