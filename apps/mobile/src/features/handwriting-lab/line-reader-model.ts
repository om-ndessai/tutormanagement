// Ported from apps/web/src/features/handwriting-lab/use-line-reader.ts @ 4b16671 (working tree: Phase
// 54): the hook's rules, pulled out so Jest covers them (design #64). Lines are found from the gaps in
// the ink (shared `segmentLines`) on every stroke; a line is known by its key, which changes whenever its
// ink does, so only a changed line is ever sent again. Pure: no React, no network.
import {
  HANDWRITING_LIMITS,
  formatStroke,
  type CanvasStroke,
  type HandwritingReading,
  type InkLine,
  type ReadHandwritingInput,
} from '@tmi/shared';

export interface LineState {
  line: InkLine;
  /** The reading of this exact ink, once it has come back. */
  reading: HandwritingReading | null;
  /** While this ink is being read: the last reading of the line in this place, if any. */
  previous: HandwritingReading | null;
  pending: boolean;
}

/** Each reading with the place its line had when it was asked for, and when it came back. */
export interface ReadingEntry {
  reading: HandwritingReading;
  index: number;
  seq: number;
}
export type Readings = Record<string, ReadingEntry>;

/** Why a request failed, as the line will say it. */
export interface ReadProblem {
  code: string;
  message: string;
}

export const READ_FAILED: ReadProblem = {
  code: 'internal_error',
  message: 'The line could not be read. Try again.',
};

/** A line whose request failed as a whole: the web's `failedReading`. */
export function failedReading(key: string, problem: ReadProblem = READ_FAILED): HandwritingReading {
  return {
    key,
    status: 'failed',
    latex: null,
    is_math: false,
    confidence: null,
    matched: null,
    ms: 0,
    image: null,
    error: { code: problem.code, message: problem.message },
  };
}

/**
 * The lines to send now: none already on their way; of the rest, those with no reading or a failed one
 * -- or every one, when the reader asked to read again.
 */
export function linesToRead(
  targets: readonly InkLine[],
  readings: Readings,
  inFlight: ReadonlySet<string>,
  again = false,
): InkLine[] {
  return targets.filter(
    (line) =>
      !inFlight.has(line.key) &&
      (again || !readings[line.key] || readings[line.key]!.reading.status === 'failed'),
  );
}

/** Lines in requests of at most `size` (HANDWRITING_LIMITS.linesPerRequest). */
export function batchLines(lines: readonly InkLine[], size: number = HANDWRITING_LIMITS.linesPerRequest): InkLine[][] {
  const batches: InkLine[][] = [];
  for (let i = 0; i < lines.length; i += size) batches.push(lines.slice(i, i + size));
  return batches;
}

/** One request: each line's strokes as they travel, taken from the page as it is when sent. */
export function readRequest(
  batch: readonly InkLine[],
  page: readonly CanvasStroke[],
  includeImage: boolean,
): ReadHandwritingInput {
  return {
    include_image: includeImage,
    lines: batch.map((line) => ({
      key: line.key,
      strokes: line.strokes.map((index) => formatStroke(page[index]!)),
    })),
  };
}

/** The readings with a batch's replies added, each with its line's place when asked and the arrival. */
export function mergeReadings(
  readings: Readings,
  results: readonly HandwritingReading[],
  batch: readonly InkLine[],
  seq: number,
): Readings {
  const places = new Map(batch.map((line) => [line.key, line.index]));
  const next = { ...readings };
  for (const reading of results) next[reading.key] = { reading, index: places.get(reading.key) ?? -1, seq };
  return next;
}

/**
 * Each line as the panel shows it. While its new ink is read, a line keeps the last words read in its
 * place (the latest to arrive), so the panel does not blank between two readings.
 */
export function lineStates(
  lines: readonly InkLine[],
  readings: Readings,
  pending: Readonly<Record<string, true>>,
): LineState[] {
  return lines.map((line) => {
    const reading = readings[line.key]?.reading ?? null;
    let previous: ReadingEntry | null = null;
    if (!reading) {
      for (const entry of Object.values(readings)) {
        if (entry.index === line.index && entry.reading.status === 'read' && (!previous || entry.seq > previous.seq)) {
          previous = entry;
        }
      }
    }
    return { line, reading, previous: previous?.reading ?? null, pending: Boolean(pending[line.key]) };
  });
}

/** Marks lines as being read, or no longer. */
export function withPending(pending: Readonly<Record<string, true>>, lines: readonly InkLine[], on: boolean) {
  const next = { ...pending };
  for (const line of lines) {
    if (on) next[line.key] = true;
    else delete next[line.key];
  }
  return next;
}
