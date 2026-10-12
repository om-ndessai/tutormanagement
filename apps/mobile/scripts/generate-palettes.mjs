// Generate the app's colour tokens from the web app's stylesheet.
//
// apps/web/src/index.css is the single source of truth for every organization's palette: a
// `--brand-50..950` ramp and the semantic tokens (--primary, --muted, --border, ...), written in
// OKLCH, light and dark. React Native cannot read CSS or OKLCH, so this script applies the same
// cascade the browser does and writes sRGB hex into src/theme/palettes.generated.ts.
//
//   light, palette p = :root  <  :root[data-palette=p]
//   dark,  palette p = :root  <  .dark  <  :root[data-palette=p]  <  .dark:root[data-palette=p]
//
// (`:root[data-palette]` outranks `.dark` on specificity, which is why every palette restates
// its dark tokens.) 'plum', the institute's own, is the unqualified :root.
//
//   node scripts/generate-palettes.mjs          write the file
//   node scripts/generate-palettes.mjs --check  fail if the file is stale (run by typecheck)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(here, '../../web/src/index.css');
const OUT = resolve(here, '../src/theme/palettes.generated.ts');
const PALETTES = ['platform', 'indigo', 'teal', 'forest', 'crimson', 'amber', 'plum'];

/** Every top-level `selector { --x: v; }` block, comments stripped. */
export function parseBlocks(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    // Drop any statements (@import ...;) that precede the selector.
    const selector = m[1].split(';').pop().trim();
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0) continue;
      const name = d.slice(0, i).trim();
      if (name.startsWith('--')) decls[name] = d.slice(i + 1).trim();
    }
    blocks.push({ selector, decls });
  }
  return blocks;
}

function merged(blocks, selectors) {
  const out = {};
  for (const sel of selectors) {
    for (const b of blocks) if (b.selector === sel) Object.assign(out, b.decls);
  }
  return out;
}

function resolveVars(decls) {
  const out = {};
  const get = (name, depth = 0) => {
    if (depth > 20) throw new Error(`var() cycle at ${name}`);
    const v = decls[name];
    if (v === undefined) throw new Error(`undefined custom property ${name}`);
    return v.replace(/var\((--[\w-]+)\)/g, (_, n) => get(n, depth + 1));
  };
  for (const name of Object.keys(decls)) out[name] = get(name);
  return out;
}

/** oklch(L C H [/ A]) -> #rrggbb or #rrggbbaa (CSS Color 4 maths, clamped to sRGB). */
export function oklchToHex(value) {
  const m = value.match(/^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)$/);
  if (!m) return null;
  let L = parseFloat(m[1]);
  if (m[1].endsWith('%')) L /= 100;
  const C = parseFloat(m[2]);
  const H = (parseFloat(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    mm = m_ ** 3,
    s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
  ];
  const hex = lin
    .map((c) => {
      const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
  let alpha = '';
  if (m[4] !== undefined) {
    let A = parseFloat(m[4]);
    if (m[4].endsWith('%')) A /= 100;
    if (A < 1)
      alpha = Math.round(A * 255)
        .toString(16)
        .padStart(2, '0');
  }
  return `#${hex}${alpha}`.toUpperCase();
}

const camel = (name) => name.replace(/^--/, '').replace(/-(\w)/g, (_, c) => c.toUpperCase());

export function generate(css) {
  const blocks = parseBlocks(css);
  const result = {};
  for (const p of PALETTES) {
    const own = p === 'plum' ? [] : [`:root[data-palette='${p}']`];
    const ownDark = p === 'plum' ? [] : [`.dark:root[data-palette='${p}']`];
    const schemes = {
      light: merged(blocks, [':root', ...own]),
      dark: merged(blocks, [':root', '.dark', ...own, ...ownDark]),
    };
    result[p] = {};
    for (const [scheme, decls] of Object.entries(schemes)) {
      const resolved = resolveVars(decls);
      const tokens = {};
      for (const [name, value] of Object.entries(resolved)) {
        const hex = oklchToHex(value);
        if (hex) tokens[camel(name)] = hex;
      }
      result[p][scheme] = Object.fromEntries(Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b)));
    }
  }
  return result;
}

export function render(result) {
  return [
    '// GENERATED by scripts/generate-palettes.mjs from apps/web/src/index.css. Do not edit:',
    '// change the stylesheet and run `node scripts/generate-palettes.mjs`.',
    '',
    `export const PALETTE_TOKENS = ${JSON.stringify(result, null, 2)} as const;`,
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = render(generate(readFileSync(CSS, 'utf8')));
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {}
    if (current !== text) {
      console.error(
        'src/theme/palettes.generated.ts is stale: run `node scripts/generate-palettes.mjs` in apps/mobile.',
      );
      process.exit(1);
    }
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT}`);
  }
}
