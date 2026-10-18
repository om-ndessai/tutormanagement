// The rules of apps/web/src/features/canvas-assessments/{review-assessment-page.tsx,
// assessments-page.tsx, assessment-pdf-page.tsx} (Phase 40), kept pure so they are tested without a
// screen: the stored ink read back, the draft as it is sent, the line that says whether it is saved,
// what a row of the list shows and offers, and the PDF screen's line.
import {
  CANVAS_ASSESSMENT_STATUS_LABELS,
  REVIEW_PAGE,
  formatRelativeTime,
  formatStroke,
  parseStroke,
  type CanvasAssessment,
  type CanvasReview,
  type CanvasStroke,
  type SaveCanvasReviewInput,
} from '@tmi/shared';

import { reviewSummary } from './assessment-model';

/** The tutor's pen, in PDF points: a firm red line on the page. */
export const REVIEW_PEN = 2;
/** The draft saves itself this long after the tutor stops. */
export const AUTOSAVE_MS = 1500;

export type Ink = Record<string, CanvasStroke[]>;

/** The stored ink, read back in the page's points; a mark that cannot be read is left out. */
export function inkFrom(review: Pick<CanvasReview, 'ink'>): Ink {
  return Object.fromEntries(
    review.ink.map((page) => [
      page.question_id,
      page.strokes.map((text) => parseStroke(text, REVIEW_PAGE)).filter((s): s is CanvasStroke => s !== null),
    ]),
  );
}

/** The draft as `PUT /:id/review` takes it: every page's ink on the wire. */
export function reviewPayload(comment: string, notes: Record<string, string>, ink: Ink): SaveCanvasReviewInput {
  return {
    comment,
    notes,
    ink: Object.entries(ink).map(([question_id, strokes]) => ({
      question_id,
      strokes: strokes.map(formatStroke),
    })),
  };
}

export type SaveState = 'saved' | 'saving' | 'failed';

/** The line under the editor's title (the web's `review-save-state`). */
export function saveStateText({
  final,
  finishedAt,
  saveState,
  dirty,
  now,
}: {
  final: boolean;
  finishedAt: string | null;
  saveState: SaveState;
  dirty: boolean;
  now?: Date;
}): string {
  if (final) {
    return `Saved as reviewed${finishedAt ? ` ${formatRelativeTime(finishedAt, now)}` : ''}. Reopen it to change it.`;
  }
  if (saveState === 'saving') return 'Saving…';
  if (saveState === 'failed') return 'Not saved yet. It will try again as you work.';
  if (dirty) return 'Changes not saved yet…';
  return 'Draft saved. Only the student’s tutors and the office see it until it is saved as reviewed.';
}

/** A row's status: "Reviewed" once a tutor has saved it as reviewed. */
export function statusLabel(row: Pick<CanvasAssessment, 'status' | 'reviewed_at'>): string {
  return row.reviewed_at ? 'Reviewed' : CANVAS_ASSESSMENT_STATUS_LABELS[row.status];
}

/** What a row of the list offers its reader (the web's buttons, from the server's flags). */
export interface RowActions {
  continue: boolean;
  discard: boolean;
  /** Review, Continue review or Edit review; null when the reader does not review. */
  review: 'Review' | 'Continue review' | 'Edit review' | null;
  submittedPdf: boolean;
  openReview: boolean;
}

export function rowActions(
  row: Pick<CanvasAssessment, 'can_continue' | 'can_review' | 'reviewed_at' | 'review_draft'>,
): RowActions {
  return {
    continue: row.can_continue,
    discard: row.can_continue,
    review: row.can_review
      ? row.reviewed_at
        ? 'Edit review'
        : row.review_draft
          ? 'Continue review'
          : 'Review'
      : null,
    submittedPdf: row.can_review,
    openReview: Boolean(row.reviewed_at),
  };
}

/** The PDF screen's line: who reviewed it and when, or the submitted summary. */
export function pdfScreenSummary(
  row: CanvasAssessment,
  kind: 'submitted' | 'reviewed',
  now?: Date,
): string {
  if (kind === 'reviewed') {
    return `Reviewed by ${row.reviewed_by_name ?? 'the tutor'}${
      row.reviewed_at ? ` ${formatRelativeTime(row.reviewed_at, now)}` : ''
    }`;
  }
  return reviewSummary(row);
}

/** Whether the PDF screen may show this PDF to this reader (the server answers 404 otherwise). */
export function mayOpenPdf(
  row: Pick<CanvasAssessment, 'can_review' | 'reviewed_at'>,
  kind: 'submitted' | 'reviewed',
): boolean {
  return kind === 'reviewed' ? Boolean(row.reviewed_at) : row.can_review;
}
