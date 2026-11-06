// Phase 75 (docs/journey-fixes-plan.md JF18): a refusal said once, in full. The server's 422 for a lesson it cannot
// price carries its message in the reader's words ("Ask the office to set Yusuf's price.") AND the same words under
// `details.mode`; a sheet that showed both said it twice, and one that showed only `notes ?? message` lost the mode's
// entirely. So: the message once, then every field error that says something else, each as text.
import { ApiRequestError } from '@/lib/api-client';

/**
 * The lines a sheet prints for a refusal: the message, then each field error not already said -- except the fields the
 * sheet shows under their own input (`shownFields`, e.g. the stop sheet's notes), which stay there.
 */
export function refusalLines(
  message: string,
  fieldErrors: Record<string, string>,
  shownFields: readonly string[] = [],
): string[] {
  const lines = [message];
  for (const [field, text] of Object.entries(fieldErrors)) {
    if (shownFields.includes(field)) continue;
    if (!lines.includes(text)) lines.push(text);
  }
  return lines.filter((line) => line.trim().length > 0);
}

/** A caught failure as those lines (`fallback` when it is not the server's refusal). */
export function failureLines(failure: unknown, fallback: string, shownFields: readonly string[] = []): string[] {
  return failure instanceof ApiRequestError
    ? refusalLines(failure.message, failure.fieldErrors, shownFields)
    : [fallback];
}
