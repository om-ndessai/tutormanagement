import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HANDWRITING_LIMITS,
  formatStroke,
  segmentLines,
  type CanvasStroke,
  type HandwritingReadResult,
  type HandwritingReading,
  type InkLine,
  type ReadHandwritingInput,
} from '@tmi/shared';

import { ApiRequestError } from '@/lib/api-client';

// Phase 54: the canvas's lines, each read once the pen rests. Lines are found
// from the gaps in the ink (segmentLines, shared) on every stroke; a line is
// known by its key, which changes whenever its ink does, so only a changed line
// is ever sent again. Kept apart from the lab's page so the student's canvas can
// use it at stage 2, with its own read function (and its own consent rule).

export interface LineState {
  line: InkLine;
  /** The reading of this exact ink, once it has come back. */
  reading: HandwritingReading | null;
  /** While this ink is being read: the last reading of the line in this place, if any. */
  previous: HandwritingReading | null;
  pending: boolean;
}

function failedReading(key: string, error: unknown): HandwritingReading {
  return {
    key,
    status: 'failed',
    latex: null,
    is_math: false,
    confidence: null,
    matched: null,
    ms: 0,
    image: null,
    error: {
      code: error instanceof ApiRequestError ? error.code : 'internal_error',
      message: error instanceof ApiRequestError ? error.message : 'The line could not be read. Try again.',
    },
  };
}

export function useLineReader(
  strokes: readonly CanvasStroke[],
  options: {
    read: (input: ReadHandwritingInput) => Promise<HandwritingReadResult>;
    /** How long the pen must rest before changed lines are read. */
    pauseMs?: number;
    /** Send back the picture the reader saw (the lab's "What the reader saw"). */
    includeImage?: boolean;
  },
) {
  const { read, pauseMs = HANDWRITING_LIMITS.pauseMs, includeImage = false } = options;
  const lines = useMemo(() => segmentLines(strokes), [strokes]);
  // Each reading with the place its line had when it was asked for, and when it came back.
  const [readings, setReadings] = useState<Record<string, { reading: HandwritingReading; index: number; seq: number }>>({});
  const [pending, setPending] = useState<Record<string, true>>({});
  const [source, setSource] = useState<{ provider: string; model: string } | null>(null);
  // The latest of each, for callbacks that outlive a render.
  const readingsRef = useRef(readings);
  readingsRef.current = readings;
  const inFlight = useRef(new Set<string>());
  const arrivals = useRef(0);
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;

  const readLines = useCallback(
    async (targets: readonly InkLine[], again = false) => {
      const todo = targets.filter(
        (line) =>
          !inFlight.current.has(line.key) &&
          (again || !readingsRef.current[line.key] || readingsRef.current[line.key]!.reading.status === 'failed'),
      );
      if (todo.length === 0) return;
      for (const line of todo) inFlight.current.add(line.key);
      setPending((p) => ({ ...p, ...Object.fromEntries(todo.map((line) => [line.key, true as const])) }));

      const batches: InkLine[][] = [];
      for (let i = 0; i < todo.length; i += HANDWRITING_LIMITS.linesPerRequest) {
        batches.push(todo.slice(i, i + HANDWRITING_LIMITS.linesPerRequest));
      }
      await Promise.all(
        batches.map(async (batch) => {
          let results: HandwritingReading[];
          try {
            const page = strokesRef.current;
            const result = await read({
              include_image: includeImage,
              lines: batch.map((line) => ({
                key: line.key,
                strokes: line.strokes.map((index) => formatStroke(page[index]!)),
              })),
            });
            setSource({ provider: result.provider, model: result.model });
            results = result.readings;
          } catch (error) {
            results = batch.map((line) => failedReading(line.key, error));
          }
          const places = new Map(batch.map((line) => [line.key, line.index]));
          arrivals.current += 1;
          const seq = arrivals.current;
          setReadings((r) => ({
            ...r,
            ...Object.fromEntries(
              results.map((reading) => [reading.key, { reading, index: places.get(reading.key) ?? -1, seq }]),
            ),
          }));
          for (const line of batch) inFlight.current.delete(line.key);
          setPending((p) => {
            const next = { ...p };
            for (const line of batch) delete next[line.key];
            return next;
          });
        }),
      );
    },
    [read, includeImage],
  );

  // Once the pen has rested, read whatever changed.
  useEffect(() => {
    if (lines.length === 0) return;
    const timer = setTimeout(() => void readLines(lines), pauseMs);
    return () => clearTimeout(timer);
  }, [lines, pauseMs, readLines]);

  const states: LineState[] = lines.map((line) => {
    const reading = readings[line.key]?.reading ?? null;
    // While its new ink is read, a line keeps the last words read in its place.
    let previous: { reading: HandwritingReading; seq: number } | null = null;
    if (!reading) {
      for (const entry of Object.values(readings)) {
        if (entry.index === line.index && entry.reading.status === 'read' && (!previous || entry.seq > previous.seq)) previous = entry;
      }
    }
    return { line, reading, previous: previous?.reading ?? null, pending: Boolean(pending[line.key]) };
  });

  return {
    lines: states,
    /** Which provider and model answered last: `fake` anywhere but production. */
    source,
    reading: Object.keys(pending).length > 0,
    /** Reads every line that has no reading yet, or whose reading failed, now. */
    readNow: () => readLines(lines),
    /** Reads one line again, whatever it said. */
    readAgain: (line: InkLine) => readLines([line], true),
  };
}
