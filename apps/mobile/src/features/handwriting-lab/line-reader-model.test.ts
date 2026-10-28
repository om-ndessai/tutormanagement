// The line reader's rules (the web's use-line-reader.ts): only changed lines are sent, at most four a
// request, a failed request fails its own lines, and a line being re-read keeps its last reading.
import { HANDWRITING_LIMITS, formatStroke, segmentLines, writeLine, type HandwritingReading } from '@tmi/shared';

import {
  batchLines,
  failedReading,
  lineStates,
  linesToRead,
  mergeReadings,
  readRequest,
  withPending,
  type Readings,
} from './line-reader-model';

const page = [
  ...writeLine('12+7=19', { x: 40, baseline: 76, size: 44, seed: 1 }),
  ...writeLine('3x=15', { x: 40, baseline: 276, size: 44, seed: 2 }),
];
const lines = segmentLines(page);

function read(key: string, latex: string, extra: Partial<HandwritingReading> = {}): HandwritingReading {
  return {
    key,
    status: 'read',
    latex,
    is_math: true,
    confidence: 0.9,
    matched: null,
    ms: 5,
    image: null,
    error: null,
    ...extra,
  };
}

describe('the page', () => {
  it('finds the two written lines, top first', () => {
    expect(lines).toHaveLength(2);
    expect(lines[0]!.index).toBe(0);
    expect(lines[0]!.strokes).toHaveLength(9);
    expect(lines[1]!.strokes).toHaveLength(7);
  });
});

describe('linesToRead', () => {
  it('sends a line with no reading, or a failed one, and none already on its way', () => {
    const [first, second] = lines as [(typeof lines)[0], (typeof lines)[0]];
    expect(linesToRead(lines, {}, new Set())).toEqual(lines);
    expect(linesToRead(lines, {}, new Set([first.key]))).toEqual([second]);
    const readings: Readings = {
      [first.key]: { reading: read(first.key, '9'), index: 0, seq: 1 },
      [second.key]: { reading: failedReading(second.key), index: 1, seq: 1 },
    };
    expect(linesToRead(lines, readings, new Set())).toEqual([second]);
  });

  it('sends every line again when asked to read again', () => {
    const readings: Readings = { [lines[0]!.key]: { reading: read(lines[0]!.key, '9'), index: 0, seq: 1 } };
    expect(linesToRead([lines[0]!], readings, new Set(), true)).toEqual([lines[0]]);
  });
});

describe('batchLines', () => {
  it('sends at most HANDWRITING_LIMITS.linesPerRequest lines a request', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ ...lines[0]!, key: `k${i}`, index: i }));
    const batches = batchLines(many);
    expect(HANDWRITING_LIMITS.linesPerRequest).toBe(4);
    expect(batches.map((b) => b.length)).toEqual([4, 4, 1]);
    expect(batchLines([])).toEqual([]);
  });
});

describe('readRequest', () => {
  it("sends each line's strokes as they travel, from the page as it is", () => {
    const request = readRequest([lines[1]!], page, true);
    expect(request.include_image).toBe(true);
    expect(request.lines).toEqual([
      { key: lines[1]!.key, strokes: lines[1]!.strokes.map((i) => formatStroke(page[i]!)) },
    ]);
  });
});

describe('failedReading', () => {
  it("says the server's words, or a generic sentence", () => {
    expect(failedReading('k', { code: 'ai_unavailable', message: 'Switched off.' })).toMatchObject({
      key: 'k',
      status: 'failed',
      latex: null,
      error: { code: 'ai_unavailable', message: 'Switched off.' },
    });
    expect(failedReading('k').error).toEqual({
      code: 'internal_error',
      message: 'The line could not be read. Try again.',
    });
  });
});

describe('mergeReadings and lineStates', () => {
  it("keeps each reading with its line's place, and shows it", () => {
    const readings = mergeReadings({}, [read(lines[0]!.key, '9')], [lines[0]!], 1);
    expect(readings[lines[0]!.key]).toMatchObject({ index: 0, seq: 1 });
    const states = lineStates(lines, readings, withPending({}, [lines[1]!], true));
    expect(states[0]).toMatchObject({ reading: { latex: '9' }, previous: null, pending: false });
    expect(states[1]).toMatchObject({ reading: null, previous: null, pending: true });
  });

  it('keeps the latest reading in a place while new ink there is read', () => {
    let readings = mergeReadings({}, [read('old-a', '8')], [{ ...lines[0]!, key: 'old-a' }], 1);
    readings = mergeReadings(readings, [read('old-b', '9')], [{ ...lines[0]!, key: 'old-b' }], 2);
    readings = mergeReadings(readings, [failedReading('old-c')], [{ ...lines[0]!, key: 'old-c' }], 3);
    const [state] = lineStates([lines[0]!], readings, { [lines[0]!.key]: true });
    expect(state!.reading).toBeNull();
    expect(state!.previous?.latex).toBe('9');
  });

  it('marks lines as read, and no longer', () => {
    const on = withPending({}, lines, true);
    expect(Object.keys(on)).toHaveLength(2);
    expect(withPending(on, [lines[0]!], false)).toEqual({ [lines[1]!.key]: true });
  });
});
