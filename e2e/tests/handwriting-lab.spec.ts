import { inflateSync } from 'node:zlib';
import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import {
  HANDWRITING_LIMITS,
  formatStroke,
  isMathReading,
  normalizeReading,
  readingMatches,
  segmentLines,
  syntheticSamples,
  writeLine,
} from '@tmi/shared';

/**
 * Phase 54 (AI-13 stage 0): the Handwriting lab. Lines are found from the gaps in the ink, each
 * changed line is drawn as a picture in the Worker and read blind (here by the fake provider, which
 * reads a line as its number of strokes), and what was read appears beside the canvas. Platform
 * admins only: every line read here is an adult's (docs/think-aloud-plan.md).
 */

const READ = '/api/platform/handwriting/read';
const SAMPLES = '/api/platform/handwriting/samples';
const CORPUS = '/api/platform/handwriting/corpus';

/** A synthetic line as it travels. */
const wire = (latex: string, baseline = 120, seed = 1) => writeLine(latex, { x: 40, baseline, seed }).map(formatStroke);

/** Only this spec writes samples: start each test from none. */
async function clearSamples(page: Page) {
  const list = await unwrap<any>(await page.request.get(`${SAMPLES}?limit=200`), 'samples');
  for (const sample of list.samples) await page.request.delete(`${SAMPLES}/${sample.id}`);
}

/** A PNG's size and pixels: signature, header and inflated rows (8-bit grey, filter 0). */
function readPng(bytes: Buffer): { width: number; height: number; pixels: Buffer } {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const chunks: Buffer[] = [];
  let width = 0;
  let height = 0;
  for (let at = 8; at < bytes.length; ) {
    const length = bytes.readUInt32BE(at);
    const type = bytes.toString('latin1', at + 4, at + 8);
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect(data[8]).toBe(8); // bit depth
      expect(data[9]).toBe(0); // greyscale
    }
    if (type === 'IDAT') chunks.push(data);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  expect(raw.length).toBe((width + 1) * height);
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) raw.copy(pixels, y * width, y * (width + 1) + 1, (y + 1) * (width + 1));
  return { width, height, pixels };
}

test.describe('the handwriting reader: its pure parts', () => {
  test('lines are found from the gaps in the ink, and a fraction stays one line', () => {
    const page = [
      ...writeLine('3x+5=20', { x: 40, baseline: 100, seed: 1 }),
      ...writeLine('3x=15', { x: 40, baseline: 200, seed: 2 }),
      ...writeLine('\\frac{3}{4}+\\frac{1}{4}=1', { x: 40, baseline: 330, seed: 3 }),
    ];
    const lines = segmentLines(page);
    expect(lines.map((line) => line.index)).toEqual([0, 1, 2]);
    expect(lines.every((line, i) => i === 0 || line.top > lines[i - 1]!.bottom)).toBe(true);
    // Every stroke is in exactly one line.
    expect(lines.flatMap((line) => line.strokes).sort((a, b) => a - b)).toEqual(page.map((_, i) => i));

    // More ink on the second line changes its key alone: only it would be read again.
    const after = segmentLines([...page, ...writeLine('2', { x: 400, baseline: 200, seed: 9 })]);
    expect(after).toHaveLength(3);
    expect(after[0]!.key).toBe(lines[0]!.key);
    expect(after[1]!.key).not.toBe(lines[1]!.key);
    expect(after[2]!.key).toBe(lines[2]!.key);

    // The synthetic set, neat and hurried, stacked fractions included: one line each.
    const samples = syntheticSamples();
    expect(samples).toHaveLength(40);
    for (const sample of samples) expect(segmentLines(sample.strokes), sample.id).toHaveLength(1);
  });

  test('what a reading may say, and when two readings say the same', () => {
    for (const maths of ['3x+5=20', '\\frac{3}{4}+\\frac{1}{4}=1', '7\\times8=54', '9-4=', 'x^{2}\\le 12', '2ab+c', '\\sqrt{16}=4']) {
      expect(isMathReading(maths), maths).toBe(true);
    }
    for (const words of ['x is five', 'hello', '\\text{seven}', '\\href{x}{y}', '']) {
      expect(isMathReading(words), words).toBe(false);
    }
    expect(normalizeReading('\\dfrac{1}{2} + x^{2} \\leq 3')).toBe('\\frac12+x^2\\le3');
    expect(readingMatches('$\\left(8-3\\right)\\times 2$', '(8-3)\\times2')).toBe(true);
    expect(readingMatches('−4+9', '-4+9')).toBe(true);
    // What a reader could genuinely get wrong stays different.
    expect(readingMatches('3\\cdot4', '3\\times4')).toBe(false);
    expect(readingMatches('3/4', '\\frac{3}{4}')).toBe(false);
    expect(readingMatches('x=5', 'x=6')).toBe(false);
    expect(readingMatches(null, 'x')).toBe(false);
  });
});

test.describe('the handwriting routes', () => {
  test('a platform admin has lines read blind, one call each, with the picture the reader saw', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const first = wire('12+7=19');
    const second = wire('\\frac{3}{4}+\\frac{1}{4}=1');
    const result = await unwrap<any>(
      await platform.request.post(READ, {
        data: {
          include_image: true,
          lines: [
            { key: 'one', strokes: first, truth: String(first.length) },
            { key: 'two', strokes: second },
          ],
        },
      }),
      'read',
    );
    expect(result.provider).toBe('fake');
    expect(result.model).toBe('claude-haiku-5-5');
    const [one, two] = result.readings;
    // The fake reads a line as its number of strokes; with what it says, the Worker says whether it matched.
    expect(one).toMatchObject({ key: 'one', status: 'read', latex: String(first.length), is_math: true, matched: true, error: null });
    expect(two).toMatchObject({ key: 'two', status: 'read', latex: String(second.length), matched: null });

    // The picture is a real PNG of the ink: dark ink on white paper, cropped, a sensible size.
    const png = readPng(Buffer.from(one.image.split(',')[1], 'base64'));
    expect(png.height).toBeGreaterThan(60);
    expect(png.height).toBeLessThan(400);
    expect(png.width).toBeGreaterThan(png.height);
    const ink = [...png.pixels].filter((v) => v < 64).length;
    const paper = [...png.pixels].filter((v) => v === 255).length;
    expect(ink).toBeGreaterThan(200);
    expect(paper).toBeGreaterThan(ink);

    // No picture unless asked for.
    const plain = await unwrap<any>(await platform.request.post(READ, { data: { lines: [{ key: 'x', strokes: first }] } }), 'read');
    expect(plain.readings[0].image).toBeNull();
  });

  test('lines that are not lines are refused', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const offPage = await platform.request.post(READ, { data: { lines: [{ key: 'a', strokes: ['4 10 10 2000 10'] }] } });
    expect(offPage.status()).toBe(422);
    expect((await offPage.json()).error.details['lines.0.strokes']).toBeTruthy();

    const tooMany = Array.from({ length: HANDWRITING_LIMITS.linesPerRequest + 1 }, (_, i) => ({ key: `k${i}`, strokes: ['4 1 1 2 2'] }));
    expect((await platform.request.post(READ, { data: { lines: tooMany } })).status()).toBe(422);
    expect((await platform.request.post(READ, { data: { lines: [] } })).status()).toBe(422);

    // A line may carry so much ink and no more.
    const long = `4 ${Array.from({ length: 2_200 }, (_, i) => `${i % 1000} ${(i * 7) % 800}`).join(' ')}`;
    const heavy = await platform.request.post(READ, { data: { lines: [{ key: 'a', strokes: [long, long] }] } });
    expect(heavy.status()).toBe(422);

    const notJson = await platform.request.post(READ, { data: Buffer.from('nope'), headers: { 'content-type': 'application/json' } });
    expect(notJson.status()).toBe(400);
  });

  test('samples are kept, counted, exported and deleted, and the log never says what was written', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await clearSamples(platform);
    const strokes = wire('3x=15');

    const right = await unwrap<any>(
      await platform.request.post(SAMPLES, {
        data: { strokes, truth: '3x=15', category: 'clear', reading: '3x = 15', reading_status: 'read', reading_model: 'claude-haiku-5-5' },
      }),
      'save right',
    );
    expect(right).toMatchObject({ truth: '3x=15', matched: true, stroke_count: strokes.length, written_by_name: 'Nav Dessai' });
    const misread = await unwrap<any>(
      await platform.request.post(SAMPLES, {
        data: { strokes, truth: '3x=15', category: 'messy', reading: '3x=16', reading_status: 'read', reading_model: 'claude-haiku-5-5' },
      }),
      'save misread',
    );
    expect(misread.matched).toBe(false);

    // What was written is required, and never an SSN.
    for (const truth of ['  ', '123-45-6789']) {
      const refused = await platform.request.post(SAMPLES, {
        data: { strokes, truth, category: 'clear', reading: null, reading_status: null, reading_model: null },
      });
      expect(refused.status(), truth).toBe(422);
      expect((await refused.json()).error.details.truth).toBeTruthy();
    }

    const list = await unwrap<any>(await platform.request.get(SAMPLES), 'list');
    expect(list.summary).toMatchObject({ total: 2, matched: 1 });
    expect(list.summary.by_category).toEqual([
      { category: 'clear', total: 1, matched: 1 },
      { category: 'messy', total: 1, matched: 0 },
    ]);
    // A list never carries the ink.
    expect(list.samples[0].strokes).toBeUndefined();

    // The corpus: the samples with their ink, or the synthetic set, as a file.
    const corpus = await platform.request.get(`${CORPUS}?source=samples`);
    expect(corpus.headers()['content-disposition']).toMatch(/attachment; filename="handwriting-samples-/);
    const file = await corpus.json();
    expect(file).toMatchObject({ version: 1, source: 'samples' });
    expect(file.samples.map((s: any) => s.strokes)).toEqual([strokes, strokes]);
    const synthetic = await (await platform.request.get(`${CORPUS}?source=synthetic`)).json();
    expect(synthetic.samples).toHaveLength(40);
    expect(synthetic.samples[0].truth).toBe('12+7=19');

    // Logged by kind, never by what was written.
    const audit = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'audit');
    const saved = audit.filter((event) => event.action === 'handwriting.sample_saved');
    expect(saved.length).toBeGreaterThanOrEqual(2);
    for (const event of saved) expect(event.description).not.toContain('3x');

    expect((await platform.request.delete(`${SAMPLES}/${right.id}`)).status()).toBe(200);
    expect((await platform.request.delete(`${SAMPLES}/${right.id}`)).status()).toBe(404);
    expect((await platform.request.delete(`${SAMPLES}/not-an-id`)).status()).toBe(422);
    await clearSamples(platform);
  });

  test('nobody but a platform admin reaches the lab', async ({ as }) => {
    const line = { key: 'a', strokes: wire('x=5') };
    for (const who of ['admin', 'tutor', 'student', 'parent'] as const) {
      const page = await as(who);
      expect((await page.request.post(READ, { data: { lines: [line] } })).status(), who).toBe(403);
      expect((await page.request.get(SAMPLES)).status(), who).toBe(403);
      expect((await page.request.get(`${CORPUS}?source=synthetic`)).status(), who).toBe(403);
      expect(
        (await page.request.post(SAMPLES, { data: { strokes: line.strokes, truth: 'x=5', category: 'clear', reading: null, reading_status: null, reading_model: null } })).status(),
        who,
      ).toBe(403);
    }
  });
});

test.describe('the Handwriting lab', () => {
  test('lines written are read beside the page, a changed line alone is read again, and readings become samples', { tag: '@smoke' }, async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await clearSamples(platform);

    // Which line keys each read request carried.
    const sent: string[][] = [];
    platform.on('request', (request) => {
      if (request.url().endsWith(READ) && request.method() === 'POST') {
        sent.push((request.postDataJSON() as { lines: { key: string }[] }).lines.map((line) => line.key));
      }
    });

    await platform.goto('/platform');
    await platform.getByRole('link', { name: 'Handwriting lab' }).click();
    await expect(platform.getByRole('heading', { name: 'Handwriting lab' })).toBeVisible();
    await expect(platform.getByText('Write a step on the page.')).toBeVisible();

    // The synthetic hand writes "12+7=19" (9 strokes) and "3x+5=20" (10 strokes) on the first two rules.
    await platform.getByRole('button', { name: 'Write a sample line' }).click();
    await platform.getByRole('button', { name: 'Write a sample line' }).click();
    await expect(platform.getByTestId('reading-text-1')).toContainText('I read:');
    await expect(platform.getByTestId('reading-text-1')).toContainText('9');
    await expect(platform.getByTestId('reading-text-2')).toContainText('10');
    await expect(platform.getByTestId('reading-source')).toHaveText('Fake reader');
    const before = sent.flat().length;
    expect(before).toBe(2);

    // A stroke on the second line, by hand: that line alone is read again.
    const canvas = platform.getByTestId('lab-canvas');
    const box = (await canvas.boundingBox())!;
    await platform.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.19);
    await platform.mouse.down();
    for (let step = 1; step <= 6; step += 1) {
      await platform.mouse.move(box.x + box.width * (0.62 + step * 0.01), box.y + box.height * 0.19);
    }
    await platform.mouse.up();
    await expect(platform.getByTestId('reading-text-2')).toContainText('11');
    await expect(platform.getByTestId('reading-text-1')).toContainText('9');
    expect(sent.at(-1)).toHaveLength(1);
    expect(sent.flat()).toHaveLength(before + 1);

    // The picture the reader was given.
    await platform.getByTestId('line-picture-1').click();
    await expect(platform.getByTestId('line-image-1')).toBeVisible();

    // Line 1 was read "right" (as far as this test goes); line 2 is corrected to what it says.
    await platform.getByTestId('line-right-1').click();
    await expect(platform.getByTestId('line-saved-1')).toBeVisible();
    await platform.getByTestId('line-fix-2').click();
    await platform.getByTestId('line-truth-2').fill('3x+5=20');
    await platform.getByTestId('line-save-2').click();
    await expect(platform.getByTestId('line-saved-2')).toBeVisible();

    const summary = platform.getByTestId('samples-summary');
    await expect(summary).toContainText('2 samples · read right 50%');
    await expect(summary).toContainText('A clear step: 1/2');
    await expect(platform.getByTestId('sample-row')).toHaveCount(2);

    // Undo takes the hand-drawn stroke back: line 2 is its old ink, already read, so nothing is sent.
    const sentBeforeUndo = sent.length;
    await platform.getByRole('button', { name: 'Undo' }).click();
    await expect(platform.getByTestId('reading-text-2')).toContainText('10');
    await platform.waitForTimeout(HANDWRITING_LIMITS.pauseMs + 400);
    expect(sent.length).toBe(sentBeforeUndo);

    await platform.getByRole('button', { name: 'Delete sample' }).first().click();
    await expect(platform.getByText('Sample deleted.')).toBeVisible();
    await expect(platform.getByTestId('sample-row')).toHaveCount(1);
    await clearSamples(platform);
  });

  test('the console tab is a platform admin\'s alone', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/platform/handwriting');
    await expect(admin).not.toHaveURL(/\/platform\/handwriting/);
    await expect(admin.getByRole('heading', { name: 'Handwriting lab' })).toHaveCount(0);
  });
});
