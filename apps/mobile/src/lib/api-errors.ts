import { ApiRequestError } from './api-client';

/** Phase 51: the server's "too many tries" (429). Not the person's fault, so said calmly. */
export function isRateLimited(caught: unknown): boolean {
  return caught instanceof ApiRequestError && caught.code === 'rate_limited';
}

/** The server's sentence for a refusal, or the fallback for anything that is not one. */
export function problemMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiRequestError && caught.status !== 0 ? caught.message : fallback;
}

interface ProblemToast {
  error: (text: string) => void;
  info: (text: string) => void;
}

/**
 * Shows a refusal: a rate limit as an info toast in the server's words ("Try again in 42
 * seconds."), with no error haptic; anything else as an error toast.
 */
export function showProblem(toast: ProblemToast, caught: unknown, fallback: string): void {
  if (isRateLimited(caught)) toast.info(problemMessage(caught, fallback));
  else toast.error(problemMessage(caught, fallback));
}
