import { useRef, useState } from 'react';
import { QUESTION_DRAFT_BATCH } from '@tmi/shared';

import { useCheckQuestions, useDraftQuestions } from './api';

export interface WriteProgress {
  /** The standard being worked on, and what is happening to it. */
  current: string | null;
  step: 'writing' | 'solving' | null;
  done: number;
  total: number;
  written: number;
  passed: number;
  flagged: number;
  error: string | null;
}

/** Questions per blind-solve request. */
const SOLVE_BATCH = 4;

const IDLE: WriteProgress = {
  current: null,
  step: null,
  done: 0,
  total: 0,
  written: 0,
  passed: 0,
  flagged: 0,
  error: null,
};

/**
 * Writes questions for one standard or many, one standard at a time: the model
 * writes a batch, then a second model solves the ones that passed the code
 * checks, blind. Two requests per standard, so neither runs long; a refusal
 * (switched off, over the cap) stops the run and says why.
 */
export function useWriteQuestions() {
  const draft = useDraftQuestions();
  const check = useCheckQuestions();
  const [progress, setProgress] = useState<WriteProgress>(IDLE);
  const cancelled = useRef(false);

  async function run(topics: { topic_id: string; code: string }[], count = QUESTION_DRAFT_BATCH) {
    cancelled.current = false;
    let state: WriteProgress = { ...IDLE, total: topics.length };
    setProgress(state);
    for (const topic of topics) {
      if (cancelled.current) break;
      try {
        state = { ...state, current: topic.code, step: 'writing' };
        setProgress(state);
        const written = (await draft.mutateAsync({ topic_id: topic.topic_id, count })).data.questions;
        const toSolve = written.filter((q) => q.status === 'draft').map((q) => q.id);
        state = { ...state, written: state.written + written.length, flagged: state.flagged + written.length - toSolve.length };
        if (toSolve.length > 0) {
          state = { ...state, step: 'solving' };
          setProgress(state);
          // A few at a time, so one request to the solver stays well under a couple of minutes.
          for (let start = 0; start < toSolve.length; start += SOLVE_BATCH) {
            const solved = (await check.mutateAsync(toSolve.slice(start, start + SOLVE_BATCH))).data;
            const passed = solved.filter((q) => q.status === 'checked').length;
            state = { ...state, passed: state.passed + passed, flagged: state.flagged + solved.length - passed };
            setProgress(state);
          }
        }
        state = { ...state, done: state.done + 1 };
        setProgress(state);
      } catch (error) {
        state = { ...state, error: error instanceof Error ? error.message : 'Something went wrong.' };
        setProgress(state);
        break;
      }
    }
    setProgress({ ...state, current: null, step: null });
    return state;
  }

  return {
    run,
    progress,
    running: progress.step !== null,
    cancel: () => {
      cancelled.current = true;
    },
    reset: () => setProgress(IDLE),
  };
}

export function describeProgress(progress: WriteProgress): string {
  const tally = `${progress.written} written, ${progress.passed} passed every check, ${progress.flagged} flagged`;
  if (progress.step) {
    const where = progress.total > 1 ? ` (${progress.done + 1} of ${progress.total})` : '';
    return `${progress.step === 'writing' ? 'Writing questions for' : 'Solving blind'} ${progress.current}${where}… ${tally}.`;
  }
  return progress.error ? `Stopped: ${progress.error} So far: ${tally}.` : `Done: ${tally}.`;
}
