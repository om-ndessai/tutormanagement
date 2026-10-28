// The lab's rules and words (the web's handwriting-lab-page, reading-panel and samples-card).
import {
  CANVAS_LIMITS,
  SYNTHETIC_LINES,
  formatStroke,
  saveHandwritingSampleSchema,
  segmentLines,
  type CanvasStroke,
  type HandwritingReading,
  type HandwritingSample,
} from '@tmi/shared';

import {
  EMPTY_PAGE,
  RULES,
  UNDO_STEPS,
  categoryCount,
  confidenceText,
  freeBaseline,
  labReducer,
  lineLabel,
  pageFits,
  pngSize,
  readingModel,
  readingView,
  readingWords,
  sampleInput,
  sampleMeta,
  savedToast,
  sourceLabel,
  summaryLabel,
  syntheticLine,
} from './lab-model';

const stroke = (y: number): CanvasStroke => ({ width: 4, points: [100, y, 140, y + 10] });

function reading(extra: Partial<HandwritingReading> = {}): HandwritingReading {
  return {
    key: 'k',
    status: 'read',
    latex: '9',
    is_math: true,
    confidence: 0.874,
    matched: null,
    ms: 4,
    image: null,
    error: null,
    ...extra,
  };
}

describe('the ruled page', () => {
  it('has eight lines, every 100 units', () => {
    expect(RULES).toBe(8);
  });

  it('writes on the first ruled line with no ink, or nowhere when all have some', () => {
    expect(freeBaseline([])).toBe(76);
    expect(freeBaseline([stroke(40)])).toBe(176);
    expect(freeBaseline([stroke(40), stroke(240)])).toBe(176);
    expect(freeBaseline(Array.from({ length: 8 }, (_, i) => stroke(i * 100 + 40)))).toBeNull();
  });

  it('writes the synthetic lines in turn, in the synthetic hand', () => {
    const first = syntheticLine([], 0, 12_345)!;
    expect(segmentLines(first)).toHaveLength(1);
    // The fake reader reads a line as its strokes: 12+7=19 is nine.
    expect(SYNTHETIC_LINES[0]!.truth).toBe('12+7=19');
    expect(first).toHaveLength(9);
    const second = syntheticLine(first, 1, 12_345)!;
    expect(Math.min(...second.flatMap((s) => s.points.filter((_, i) => i % 2 === 1)))).toBeGreaterThan(100);
    const wraps = syntheticLine([], SYNTHETIC_LINES.length, 1)!;
    expect(wraps).toHaveLength(9);
    expect(syntheticLine(Array.from({ length: 8 }, (_, i) => stroke(i * 100 + 40)), 0, 1)).toBeNull();
  });

  it('refuses ink past the page limits', () => {
    expect(pageFits([], [stroke(40)])).toBe(true);
    const full = Array.from({ length: CANVAS_LIMITS.strokesPerPage }, () => stroke(40));
    expect(pageFits(full, [stroke(40)])).toBe(false);
  });
});

describe('labReducer', () => {
  it('adds, erases by stroke, clears and undoes each', () => {
    const a = stroke(40);
    const b = stroke(240);
    let page = labReducer(EMPTY_PAGE, { type: 'add', strokes: [a, b] });
    expect(page.strokes).toEqual([a, b]);
    page = labReducer(page, { type: 'erase', hit: [a] });
    expect(page.strokes).toEqual([b]);
    page = labReducer(page, { type: 'clear' });
    expect(page.strokes).toEqual([]);
    page = labReducer(page, { type: 'undo' });
    expect(page.strokes).toEqual([b]);
    page = labReducer(page, { type: 'undo' });
    expect(page.strokes).toEqual([a, b]);
    page = labReducer(page, { type: 'undo' });
    expect(page).toEqual(EMPTY_PAGE);
    expect(labReducer(page, { type: 'undo' })).toBe(page);
  });

  it('changes nothing for an empty add, a missed erase or an empty clear', () => {
    const page = labReducer(EMPTY_PAGE, { type: 'add', strokes: [stroke(40)] });
    expect(labReducer(page, { type: 'add', strokes: [] })).toBe(page);
    expect(labReducer(page, { type: 'erase', hit: [stroke(40)] })).toBe(page);
    expect(labReducer(EMPTY_PAGE, { type: 'clear' })).toBe(EMPTY_PAGE);
  });

  it(`keeps ${UNDO_STEPS} steps of undo`, () => {
    let page = EMPTY_PAGE;
    for (let i = 0; i < UNDO_STEPS + 10; i += 1) page = labReducer(page, { type: 'add', strokes: [stroke(40)] });
    expect(page.history).toHaveLength(UNDO_STEPS);
  });
});

describe('what a line says', () => {
  it('shows maths, a non-maths reading only in the lab, and each other state', () => {
    expect(readingView(reading(), false)).toEqual({ kind: 'math', latex: '9' });
    const words = reading({ latex: '\\text{hello}', is_math: false });
    expect(readingView(words, true)).toEqual({ kind: 'raw', latex: '\\text{hello}' });
    expect(readingView(words, false)).toEqual({ kind: 'not-math' });
    expect(readingView(reading({ status: 'unreadable', latex: null }), true)).toEqual({ kind: 'unreadable' });
    expect(
      readingView(reading({ status: 'failed', latex: null, error: { code: 'x', message: 'Over budget.' } }), true),
    ).toEqual({ kind: 'failed', message: 'Over budget.' });
    expect(readingView(null, true)).toEqual({ kind: 'waiting' });
  });

  it('says each state in the web’s words', () => {
    expect(readingWords({ kind: 'math', latex: '\\frac{3}{4}' })).toBe('I read: 3 over 4');
    expect(readingWords({ kind: 'unreadable' })).toBe('I could not read this line.');
    expect(readingWords({ kind: 'waiting' })).toBe('Waiting for the pen to rest…');
    expect(readingWords({ kind: 'not-math' })).toBe('Read, but not as maths.');
  });

  it('gives the confidence once this ink is read', () => {
    expect(confidenceText(reading(), false)).toBe('87%');
    expect(confidenceText(reading(), true)).toBeNull();
    expect(confidenceText(reading({ confidence: null }), false)).toBeNull();
    expect(confidenceText(null, false)).toBeNull();
  });

  it('labels a line for a screen reader', () => {
    expect(lineLabel(1, { kind: 'math', latex: '9' }, '100%', false)).toBe(
      "Line 1. I read: 9. The reader's own confidence: 100%.",
    );
    expect(lineLabel(2, { kind: 'waiting' }, null, true)).toBe('Line 2. Waiting for the pen to rest. Reading.');
  });

  it('names the reader', () => {
    expect(readingModel(null)).toBeNull();
    expect(readingModel({ provider: 'fake', model: 'claude-haiku-5-5' })).toBe('fake');
    expect(readingModel({ provider: 'anthropic', model: 'claude-haiku-5-5' })).toBe('claude-haiku-5-5');
    expect(sourceLabel({ provider: 'fake', model: 'm' })).toBe('Fake reader');
    expect(sourceLabel({ provider: 'anthropic', model: 'm' })).toBe('m');
  });
});

describe('a sample', () => {
  const page = [stroke(40), stroke(240), stroke(50)];
  const [line] = segmentLines(page);

  it("sends the line's strokes, what it says and what the reader made of it", () => {
    const input = sampleInput(line!, page, reading(), '9', 'clear', 'fake');
    expect(input).toEqual({
      strokes: [formatStroke(page[0]!), formatStroke(page[2]!)],
      truth: '9',
      category: 'clear',
      reading: '9',
      reading_status: 'read',
      reading_model: 'fake',
    });
    expect(saveHandwritingSampleSchema.safeParse(input).success).toBe(true);
  });

  it('keeps no reading or model for a failed line, and no reading for an unreadable one', () => {
    expect(sampleInput(line!, page, reading({ status: 'failed', latex: null }), '9', 'messy', 'fake')).toMatchObject({
      reading: null,
      reading_status: null,
      reading_model: null,
    });
    expect(sampleInput(line!, page, reading({ status: 'unreadable', latex: null }), '9', 'messy', 'fake')).toMatchObject(
      { reading: null, reading_status: 'unreadable', reading_model: 'fake' },
    );
  });

  it('is refused before sending when what it says is empty or shaped like an SSN', () => {
    expect(saveHandwritingSampleSchema.safeParse(sampleInput(line!, page, reading(), ' ', 'clear', 'fake')).success).toBe(
      false,
    );
    expect(
      saveHandwritingSampleSchema.safeParse(sampleInput(line!, page, reading(), '123-45-6789', 'clear', 'fake')).success,
    ).toBe(false);
  });

  it('says whether it was read right', () => {
    expect(savedToast(2, true)).toBe('Line 2 saved: read right.');
    expect(savedToast(3, false)).toBe('Line 3 saved: misread.');
  });
});

describe('the samples', () => {
  it('sums them up', () => {
    expect(summaryLabel({ total: 1, matched: 1, by_category: [] })).toBe('1 sample · read right 100%');
    expect(summaryLabel({ total: 8, matched: 6, by_category: [] })).toBe('8 samples · read right 75%');
    expect(summaryLabel({ total: 0, matched: 0, by_category: [] })).toBe('0 samples · read right –');
    expect(categoryCount({ category: 'fraction', total: 4, matched: 3 })).toBe('A stacked fraction: 3/4');
  });

  it('says what each one is, who wrote it and when', () => {
    const sample: HandwritingSample = {
      id: 's1',
      stroke_count: 9,
      truth: '9',
      category: 'clear',
      reading: '9',
      reading_status: 'read',
      reading_model: 'fake',
      matched: true,
      written_by_name: 'Nav Dessai',
      created_at: '2026-10-28T10:00:00.000Z',
    };
    expect(sampleMeta(sample, new Date('2026-10-28T10:00:10.000Z'))).toBe('A clear step · fake · Nav Dessai · just now');
    expect(sampleMeta({ ...sample, reading_model: null, written_by_name: null }, new Date('2026-10-28T10:00:10.000Z'))).toBe(
      'A clear step · not read · someone · just now',
    );
  });
});

describe('pngSize', () => {
  it("reads a PNG's width and height from its header", () => {
    // The local fake reader's picture of a two-stroke line: 86 x 122.
    expect(pngSize('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAB6CAAAAAAAU/tmAAABFUlEQVR4')).toEqual({
      width: 86,
      height: 122,
    });
  });

  it('refuses anything else', () => {
    expect(pngSize('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ')).toBeNull();
    expect(pngSize('data:image/png;base64,AAAA')).toBeNull();
    expect(pngSize('data:image/png;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7')).toBeNull();
    expect(pngSize('https://example.com/x.png')).toBeNull();
  });
});
