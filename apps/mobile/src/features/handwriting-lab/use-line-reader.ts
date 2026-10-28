// Ported from apps/web/src/features/handwriting-lab/use-line-reader.ts @ 4b16671 (working tree: Phase
// 54). The canvas's lines, each read once the pen rests: segmented on every stroke, the changed ones read
// `HANDWRITING_LIMITS.pauseMs` after the last, in requests of `linesPerRequest`, a line keeping its last
// reading in place while its new ink is read. Mobile: the rules are in line-reader-model.ts (Jest), and
// the refs are kept current in effects rather than during render. Kept apart from the lab's screen, as
// on the web, so the student's canvas can use it at stage 2 with its own read function and consent rule.
import {
  HANDWRITING_LIMITS,
  segmentLines,
  type CanvasStroke,
  type HandwritingReadResult,
  type HandwritingReading,
  type InkLine,
  type ReadHandwritingInput,
} from '@tmi/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiRequestError } from '@/lib/api-client';
import {
  READ_FAILED,
  batchLines,
  failedReading,
  lineStates,
  linesToRead,
  mergeReadings,
  readRequest,
  withPending,
  type Readings,
} from './line-reader-model';

export type { LineState } from './line-reader-model';

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
  const [readings, setReadings] = useState<Readings>({});
  const [pending, setPending] = useState<Record<string, true>>({});
  const [source, setSource] = useState<{ provider: string; model: string } | null>(null);
  // The latest of each, for callbacks that outlive a render.
  const readingsRef = useRef(readings);
  const strokesRef = useRef(strokes);
  useEffect(() => {
    readingsRef.current = readings;
  }, [readings]);
  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);
  const inFlight = useRef(new Set<string>());
  const arrivals = useRef(0);

  const readLines = useCallback(
    async (targets: readonly InkLine[], again = false) => {
      const todo = linesToRead(targets, readingsRef.current, inFlight.current, again);
      if (todo.length === 0) return;
      for (const line of todo) inFlight.current.add(line.key);
      setPending((p) => withPending(p, todo, true));

      await Promise.all(
        batchLines(todo).map(async (batch) => {
          let results: HandwritingReading[];
          try {
            const result = await read(readRequest(batch, strokesRef.current, includeImage));
            setSource({ provider: result.provider, model: result.model });
            results = result.readings;
          } catch (error) {
            const problem =
              error instanceof ApiRequestError ? { code: error.code, message: error.message } : READ_FAILED;
            results = batch.map((line) => failedReading(line.key, problem));
          }
          arrivals.current += 1;
          const seq = arrivals.current;
          setReadings((r) => mergeReadings(r, results, batch, seq));
          for (const line of batch) inFlight.current.delete(line.key);
          setPending((p) => withPending(p, batch, false));
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

  return {
    lines: lineStates(lines, readings, pending),
    /** Which provider and model answered last: `fake` anywhere but production. */
    source,
    reading: Object.keys(pending).length > 0,
    /** Reads every line that has no reading yet, or whose reading failed, now. */
    readNow: () => readLines(lines),
    /** Reads one line again, whatever it said. */
    readAgain: (line: InkLine) => readLines([line], true),
  };
}
