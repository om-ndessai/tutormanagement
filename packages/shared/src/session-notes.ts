import { z } from 'zod';
import type { Rating } from './progress.js';
import { optionalText } from './users.js';

// ---------------------------------------------------------------------------
// The lesson write-up (Phase 23)
// ---------------------------------------------------------------------------
// A lesson's notes used to be one free-text box. They are now the parts a
// tutor actually works through -- what was planned, how the last lesson and
// its homework held up, what was covered, what was set -- so that a summary
// (for a report, a digest, eventually a generated paragraph) can be assembled
// from labelled facts rather than dug out of prose.
//
// `sessions.notes` stays, as "what was covered": every lesson recorded before
// this phase keeps its notes exactly where they were.
//
// Nothing here is money. The write-up is shown on the Tutoring tab, beside
// the student, and a summary built from it must never be able to carry a
// price.

const part = (max: number) => optionalText(z.string().trim().max(max));

/** How the homework set last time went, as the tutor found it. */
export const HOMEWORK_STATUSES = ['done', 'partial', 'not_done', 'none_set'] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUSES)[number];

export const HOMEWORK_STATUS_LABELS: Record<HomeworkStatus, string> = {
  done: 'Done',
  partial: 'Partly done',
  not_done: 'Not done',
  none_set: 'None was set',
};

/**
 * The structured parts, every one optional. Leaving them all out records a
 * lesson with its notes alone, as before.
 */
export const sessionWriteUpInputSchema = z.object({
  /** What the lesson was meant to cover, written before it or looking back. */
  planned: part(2000),
  /** How much of the previous lesson had stuck. */
  previous_review: part(2000),
  /** How the homework from the previous lesson went. */
  homework_review: part(2000),
  homework_status: z
    .enum(HOMEWORK_STATUSES)
    .nullish()
    .transform((value) => value ?? null),
  /** What was set for next time. */
  homework_assigned: part(2000),
});

export type SessionWriteUpInput = z.input<typeof sessionWriteUpInputSchema>;
export type SessionWriteUpPayload = z.output<typeof sessionWriteUpInputSchema>;

export interface SessionWriteUp {
  planned: string | null;
  previous_review: string | null;
  homework_review: string | null;
  homework_status: HomeworkStatus | null;
  homework_assigned: string | null;
}

/** The parts in the order a lesson runs, with the heading each is shown under. */
export const SESSION_WRITE_UP_PARTS = [
  { key: 'planned', label: 'Planned' },
  { key: 'previous_review', label: 'Previous session review' },
  { key: 'homework_review', label: 'Homework review' },
  { key: 'homework_assigned', label: 'Homework set' },
] as const satisfies readonly { key: keyof SessionWriteUp; label: string }[];

/** True when nothing in the write-up has been filled in. */
export function isWriteUpEmpty(writeUp: Partial<SessionWriteUp> | null | undefined): boolean {
  if (!writeUp) return true;

  return (
    !writeUp.planned &&
    !writeUp.previous_review &&
    !writeUp.homework_review &&
    !writeUp.homework_status &&
    !writeUp.homework_assigned
  );
}

// ---------------------------------------------------------------------------
// Assessments of a lesson
// ---------------------------------------------------------------------------
// Anybody the lesson concerns may say how it went: its tutor, the student,
// the student's parents, and the office. One each, which they may change or
// withdraw. Not to be confused with a student's placement assessment
// (Phase 16), which is the office's reading of where a student stands; this
// is a reading of one lesson.

/**
 * The capacity somebody assessed a lesson in. Decided by the API from how
 * they relate to the lesson, never sent by the client, and frozen when they
 * write it: the relationship may change later, what they were then does not.
 */
export const SESSION_ASSESSOR_ROLES = ['tutor', 'student', 'parent', 'admin'] as const;
export type SessionAssessorRole = (typeof SESSION_ASSESSOR_ROLES)[number];

export const SESSION_ASSESSOR_LABELS: Record<SessionAssessorRole, string> = {
  tutor: 'Tutor',
  student: 'Student',
  parent: 'Parent',
  admin: 'Office',
};

/** The question each kind of assessor is asked. */
export const SESSION_ASSESSMENT_PROMPTS: Record<SessionAssessorRole, string> = {
  tutor: 'How did the lesson go?',
  student: 'How did this lesson go for you?',
  parent: 'How do you feel this lesson went?',
  admin: 'How did this lesson go?',
};

/** The same 1-5 steps as every other rating, worded for a lesson. */
export const SESSION_RATING_LABELS: Record<Rating, string> = {
  1: 'Did not go well',
  2: 'Hard going',
  3: 'Okay',
  4: 'Went well',
  5: 'Excellent',
};

/**
 * A score, a few words, or both -- but not neither. Free text runs through
 * optionalText, so the SSN guard applies here as on every other note.
 */
export const sessionAssessmentInputSchema = z
  .object({
    rating: z
      .number()
      .int('Ratings are whole numbers from 1 to 5.')
      .min(1, 'Ratings run from 1 to 5.')
      .max(5, 'Ratings run from 1 to 5.')
      .nullish()
      .transform((value) => value ?? null),
    body: part(2000),
  })
  .refine((value) => value.rating !== null || value.body !== null, {
    message: 'Give a rating, a few words, or both.',
    path: ['rating'],
  });

export type SessionAssessmentInput = z.input<typeof sessionAssessmentInputSchema>;
export type SessionAssessmentPayload = z.output<typeof sessionAssessmentInputSchema>;

/** What an assessment says, without who said it: the shape a draft holds. */
export interface SessionAssessmentContent {
  rating: Rating | null;
  body: string | null;
}

export interface SessionAssessment extends SessionAssessmentContent {
  session_id: string;
  /** Who wrote it. Named even to a reader who could not otherwise see them. */
  author_user_id: string;
  author_name: string;
  author_role: SessionAssessorRole;
  created_at: string;
  updated_at: string;
}

const ROLE_ORDER: Record<SessionAssessorRole, number> = { tutor: 0, student: 1, parent: 2, admin: 3 };

/** Tutor first, then the student, their parents and the office. */
export function sortAssessments<T extends Pick<SessionAssessment, 'author_role' | 'created_at'>>(
  rows: readonly T[],
): T[] {
  return [...rows].sort(
    (a, b) =>
      ROLE_ORDER[a.author_role] - ROLE_ORDER[b.author_role] ||
      a.created_at.localeCompare(b.created_at),
  );
}
