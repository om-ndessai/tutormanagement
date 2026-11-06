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
  // Phase 67 (H5): a level tile's label on its grade's hue.
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((g) => [`grade ${g}'s label`, `grade${g}Foreground`, `grade${g}`, 4.5]),
  // Phase 78 (JF29): the drawer's words on its accent (the page you are on): the web restates the accent in the warm
  // foundation for every palette, where Indigo's own put the tagline at 1.15:1.
  ['the drawer\'s text on its accent', 'sidebarForeground', 'sidebarAccent', 4.5],
  ['the drawer\'s muted text on its accent', 'sidebarMutedForeground', 'sidebarAccent', 4.5],
  ['the drawer\'s chosen item on its accent', 'sidebarAccentForeground', 'sidebarAccent', 4.5],
  // Phase 78 (JF29): the chosen grade chip's 2pt ring, drawn in the ink over the card: a control's edge, 3:1.
  ['the chosen grade chip\'s ring on a card', 'foreground', 'card', 3],
];

/** `top` at `alpha` over `base`, as the screen composites it (sRGB, per channel). */
const over = (top, alpha, base) =>
  '#' +
  [1, 3, 5]
    .map((i) => {
      const value = Math.round(parseInt(top.slice(i, i + 2), 16) * alpha + parseInt(base.slice(i, i + 2), 16) * (1 - alpha));
      return value.toString(16).padStart(2, '0');
    })
    .join('');
/** Phase 78 (JF29): the Adv pill -- white words on Paper's `scrim` (black) at 55% over each grade's hue (`AdvPill`, play/quest-card.tsx). */
const ADV_PILL_ALPHA = 0.55;

const failures = [];
for (const [palette, schemes] of Object.entries(palettes)) {
  for (const [scheme, t] of Object.entries(schemes)) {
    const pairs = scheme === 'light' ? [...PAIRS, ['an input edge', 'input', 'background', 3]] : PAIRS;
    for (const [what, fg, bg, min] of pairs) {
      const value = ratio(t[fg], t[bg]);
      if (value < min) failures.push(`${palette} ${scheme}: ${what} is ${value.toFixed(2)}:1, needs ${min}:1`);
    }
    for (const g of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const pill = over('#000000', ADV_PILL_ALPHA, t[`grade${g}`]);
      const value = ratio('#FFFFFF', pill);
      if (value < 4.5) failures.push(`${palette} ${scheme}: the Adv pill on grade ${g} is ${value.toFixed(2)}:1, needs 4.5:1`);
    }
  }
}
// Phase 67 (H5): the eight grade hues stay apart under each colour-blindness simulation (Machado et
// al. 2009, severity 1), measured in OKLab. Colour is never the only signal, but it should still help.
const MIN_GRADE_DISTANCE = 0.07;
const SIMULATIONS = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const linear = (hex) => [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
const oklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
for (const [palette, schemes] of Object.entries(palettes)) {
  for (const [scheme, t] of Object.entries(schemes)) {
    const hues = [1, 2, 3, 4, 5, 6, 7, 8].map((g) => t[`grade${g}`]);
    for (const [name, matrix] of Object.entries(SIMULATIONS)) {
      const seen = hues.map((hex) => {
        const v = linear(hex);
        return oklab(matrix.map((row) => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))));
      });
      for (let i = 0; i < seen.length; i++) {
        for (let j = i + 1; j < seen.length; j++) {
          const d = Math.hypot(...seen[i].map((x, k) => x - seen[j][k]));
          if (d < MIN_GRADE_DISTANCE) {
            failures.push(`${palette} ${scheme}: grades ${i + 1} and ${j + 1} look alike with ${name} (${d.toFixed(3)})`);
          }
        }
      }
    }
  }
}

if (failures.length) {
  console.error(`check-contrast: ${failures.length} failing pair(s)\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('check-contrast: ok');
