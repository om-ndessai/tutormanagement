// WCAG contrast of every organization palette, light and dark, from the generated tokens
// (UI upgrades U1). Run by `npm run typecheck`: a palette edit that leaves text unreadable fails.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../src/theme/palettes.generated.ts'), 'utf8');
const palettes = JSON.parse(source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1));

const channel = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [what, text token, background token, minimum]: 4.5:1 for text, 3:1 for a control's edge.
const PAIRS = [
  ['text on the page', 'foreground', 'background', 4.5],
  ['muted text on the page', 'mutedForeground', 'background', 4.5],
  ['muted text on a card', 'mutedForeground', 'card', 4.5],
  ['a button label', 'primaryForeground', 'primary', 4.5],
  ['text on the highlight', 'highlightForeground', 'highlight', 4.5],
  ['text on the soft highlight', 'highlightSoftForeground', 'highlightSoft', 4.5],
  ['a link on the page', 'primary', 'background', 4.5],
];

const failures = [];
for (const [palette, schemes] of Object.entries(palettes)) {
  for (const [scheme, t] of Object.entries(schemes)) {
    const pairs = scheme === 'light' ? [...PAIRS, ['an input edge', 'input', 'background', 3]] : PAIRS;
    for (const [what, fg, bg, min] of pairs) {
      const value = ratio(t[fg], t[bg]);
      if (value < min) failures.push(`${palette} ${scheme}: ${what} is ${value.toFixed(2)}:1, needs ${min}:1`);
    }
  }
}
if (failures.length) {
  console.error(`check-contrast: ${failures.length} failing pair(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('check-contrast: ok');
