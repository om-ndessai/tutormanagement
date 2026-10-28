#!/usr/bin/env node
/**
 * Phase 54 (AI-13 stage 0): measures the handwriting reader against a corpus.
 *
 * Every line of the corpus is sent to the Worker's own read route -- the same
 * picture (lib/raster.ts), the same instructions (lib/ai/handwriting.ts), the same
 * runAi -- with what it says, and the Worker answers whether the reading matched
 * (shared `readingMatches`). Nothing here reimplements the reader, so a score
 * here is the score of what ships.
 *
 *   npm run handwriting:eval                                  the synthetic set, local Worker
 *   npm run handwriting:eval -- --corpus=samples              the lab's samples on that Worker
 *   npm run handwriting:eval -- --corpus=path/to/export.json  a file the lab exported
 *   options: --base=http://127.0.0.1:8787  --as=ndessai@gmail.com  --label="what changed"
 *            --limit=N  --category=fraction  --min=0.95 (exit 1 below it)  --no-images
 *
 * The local Worker reads with the FAKE provider unless apps/api/.dev.vars sets
 * AI_PROVIDER=anthropic and ANTHROPIC_API_KEY: then the scores measure the pipeline,
 * not reading, and the report says so. Results go to .handwriting-eval/<time>/
 * (gitignored): report.json, report.md, and the picture of every line not read
 * right, for a person or an agent to look at. Record what you changed and the
 * score in docs/think-aloud/reader-log.md.
 *
 * Only adults' handwriting and the synthetic hand belong in a corpus (AG1).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LINES_PER_REQUEST = 4; // HANDWRITING_LIMITS.linesPerRequest

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length > 0 ? rest.join('=') : true];
  }),
);
const base = String(args.base ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const as = String(args.as ?? 'ndessai@gmail.com');
const corpusArg = String(args.corpus ?? 'synthetic');
const saveImages = args['no-images'] !== true;
const headers = {
  'content-type': 'application/json',
  'x-dev-user': as,
  // Against a Worker with sign-in on, pass a session: TMI_SESSION=<cookie value>.
  ...(process.env.TMI_SESSION ? { cookie: `tmi_session=${process.env.TMI_SESSION}` } : {}),
};

async function api(path, init = {}) {
  const response = await fetch(`${base}/api${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status}, not JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${body?.error?.code}: ${body?.error?.message}`);
  return body;
}

async function loadCorpus() {
  if (corpusArg === 'synthetic' || corpusArg === 'samples') return api(`/platform/handwriting/corpus?source=${corpusArg}`);
  return JSON.parse(readFileSync(resolve(corpusArg), 'utf8'));
}

function quantile(values, q) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const pct = (part, whole) => (whole === 0 ? '  -  ' : `${((part / whole) * 100).toFixed(1).padStart(5)}%`);

async function main() {
  const corpus = await loadCorpus();
  if (corpus.version !== 1 || !Array.isArray(corpus.samples)) throw new Error('Not a handwriting corpus (version 1).');
  let samples = corpus.samples;
  if (args.category) samples = samples.filter((s) => s.category === args.category);
  if (args.limit) samples = samples.slice(0, Number(args.limit));
  if (samples.length === 0) throw new Error('The corpus has no samples to read.');

  const started = new Date();
  const results = [];
  let source = { provider: '?', model: '?' };
  for (let i = 0; i < samples.length; i += LINES_PER_REQUEST) {
    const batch = samples.slice(i, i + LINES_PER_REQUEST);
    const { data } = await api('/platform/handwriting/read', {
      method: 'POST',
      body: JSON.stringify({
        include_image: saveImages,
        lines: batch.map((sample) => ({ key: sample.id.slice(0, 40), strokes: sample.strokes, truth: sample.truth })),
      }),
    });
    source = { provider: data.provider, model: data.model };
    for (const sample of batch) {
      const reading = data.readings.find((r) => r.key === sample.id.slice(0, 40));
      results.push({ sample, reading });
    }
    process.stdout.write(`\rRead ${Math.min(i + LINES_PER_REQUEST, samples.length)} of ${samples.length} lines`);
  }
  process.stdout.write('\n');

  const read = results.filter((r) => r.reading.status === 'read');
  const matched = results.filter((r) => r.reading.matched === true);
  const unreadable = results.filter((r) => r.reading.status === 'unreadable');
  const failed = results.filter((r) => r.reading.status === 'failed');
  const notMath = read.filter((r) => !r.reading.is_math);
  const confident = read.filter((r) => (r.reading.confidence ?? 0) >= 0.9);
  const latencies = results.filter((r) => r.reading.status !== 'failed').map((r) => r.reading.ms);
  const categories = [...new Set(results.map((r) => r.sample.category))];

  const summary = {
    corpus: { source: corpus.source, file: corpusArg, lines: results.length },
    provider: source.provider,
    model: source.model,
    label: args.label ?? null,
    started_at: started.toISOString(),
    exact: matched.length,
    unreadable: unreadable.length,
    failed: failed.length,
    not_math: notMath.length,
    exact_rate: matched.length / results.length,
    exact_rate_of_read: read.length === 0 ? 0 : matched.length / read.length,
    confident: { lines: confident.length, exact: confident.filter((r) => r.reading.matched).length },
    latency_ms: { p50: quantile(latencies, 0.5), p90: quantile(latencies, 0.9) },
    by_category: categories.map((category) => {
      const rows = results.filter((r) => r.sample.category === category);
      return { category, lines: rows.length, exact: rows.filter((r) => r.reading.matched).length };
    }),
  };

  const lines = [
    `Handwriting reader: ${summary.provider === 'fake' ? 'FAKE provider (scores measure the pipeline, not reading)' : summary.model}`,
    `Corpus: ${corpus.source} (${corpusArg}), ${results.length} lines${args.label ? ` -- ${args.label}` : ''}`,
    '',
    `  read exactly        ${String(matched.length).padStart(4)}  ${pct(matched.length, results.length)}`,
    `  misread             ${String(read.length - matched.length).padStart(4)}  ${pct(read.length - matched.length, results.length)}`,
    `  unreadable          ${String(unreadable.length).padStart(4)}  ${pct(unreadable.length, results.length)}`,
    `  failed              ${String(failed.length).padStart(4)}  ${pct(failed.length, results.length)}${failed[0] ? `  (${failed[0].reading.error?.code})` : ''}`,
    `  not plain maths     ${String(notMath.length).padStart(4)}  ${pct(notMath.length, results.length)}  (a student would not see these)`,
    `  confident (>= 0.9)  ${String(confident.length).padStart(4)}  exact ${pct(summary.confident.exact, confident.length)}`,
    `  latency             p50 ${summary.latency_ms.p50} ms, p90 ${summary.latency_ms.p90} ms (picture and model)`,
    '',
    '  by kind of line:',
    ...summary.by_category.map((c) => `    ${c.category.padEnd(12)} ${String(c.exact).padStart(3)}/${String(c.lines).padEnd(3)} ${pct(c.exact, c.lines)}`),
  ];
  console.log(lines.join('\n'));

  const out = join(resolve(String(args.out ?? '.handwriting-eval')), started.toISOString().replace(/[:.]/g, '-'));
  mkdirSync(join(out, 'misreads'), { recursive: true });
  const misses = results.filter((r) => r.reading.matched !== true);
  const md = [
    `# Handwriting evaluation, ${started.toISOString()}`,
    '',
    '```',
    ...lines,
    '```',
    '',
    `## Lines not read right (${misses.length})`,
    '',
    '| Line | Kind | Written | Read | Confidence | Picture |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const { sample, reading } of misses) {
    const file = `misreads/${sample.id.replace(/[^\w-]/g, '_')}.png`;
    if (saveImages && reading.image) writeFileSync(join(out, file), Buffer.from(reading.image.split(',')[1], 'base64'));
    md.push(
      `| ${sample.id} | ${sample.category} | \`${sample.truth}\` | ${
        reading.status === 'read' ? `\`${reading.latex}\`` : reading.status === 'failed' ? `failed: ${reading.error?.code}` : 'unreadable'
      } | ${reading.confidence ?? '-'} | ${saveImages && reading.image ? `![](${file})` : '-'} |`,
    );
  }
  writeFileSync(join(out, 'report.md'), `${md.join('\n')}\n`);
  writeFileSync(
    join(out, 'report.json'),
    `${JSON.stringify({ ...summary, results: results.map(({ sample, reading }) => ({ id: sample.id, category: sample.category, truth: sample.truth, ...reading, image: undefined })) }, null, 2)}\n`,
  );
  console.log(`\nReport: ${join(out, 'report.md')}${saveImages ? ' (with the picture of every line not read right)' : ''}`);

  if (args.min !== undefined && summary.exact_rate < Number(args.min)) {
    console.error(`Below the pass mark: ${(summary.exact_rate * 100).toFixed(1)}% < ${(Number(args.min) * 100).toFixed(1)}%.`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`handwriting-eval: ${error.message}`);
  if (/ECONNREFUSED|fetch failed/.test(String(error.cause ?? error.message))) {
    console.error(`Is the Worker running at ${base}? Start it with npm run dev (or npm run dev:api).`);
  }
  process.exit(1);
});
