// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (the form's state
// and the bodies it sends). Every field lives in one `SessionFormValues` object, and `formBody`
// builds the body both the session and the draft endpoints take: item 19's autosave reads
// `formBody` on an interval and posts it as a draft, without changing anything here.
import type {
  Assignment,
  HomeworkStatus,
  Rating,
  SessionMode,
  SessionUpdatePayload,
  TutoringSession,
} from '@tmi/shared';
import { parseClockTime } from '@tmi/shared';
import { useCallback, useState } from 'react';

/** Common lesson lengths, offered as one tap rather than clock arithmetic. */
export const QUICK_LENGTHS = [45, 60, 75, 90, 120] as const;

export interface SessionFormValues {
  assignmentId: string;
  occurredOn: string;
  startedAt: string;
  endedAt: string;
  mode: SessionMode;
  /** "What was covered": `sessions.notes`. */
  notes: string;
  // The structured write-up (Phase 23), in the order a lesson runs.
  planned: string;
  previousReview: string;
  homeworkReview: string;
  homeworkStatus: HomeworkStatus | null;
  homeworkAssigned: string;
  goalRating: Rating | null;
  /** Topic id → rating, in the order they were scored. */
  topicRatings: Record<string, Rating>;
  // The writer's OWN assessment. On an existing lesson that is theirs alone: an admin editing a
  // tutor's lesson sees and edits the office's, not the tutor's.
  myRating: Rating | null;
  myAssessment: string;
}

/** A new lesson: today on the organization's clock, 4–5 PM, in person. */
export function emptyForm(today: string, assignments: Pick<Assignment, 'id'>[]): SessionFormValues {
  return {
    assignmentId: assignments.length === 1 ? assignments[0]!.id : '',
    occurredOn: today,
    startedAt: '16:00',
    endedAt: '17:00',
    mode: 'in_person',
    notes: '',
    planned: '',
    previousReview: '',
    homeworkReview: '',
    homeworkStatus: null,
    homeworkAssigned: '',
    goalRating: null,
    topicRatings: {},
    myRating: null,
    myAssessment: '',
  };
}

/** An existing lesson, as the form holds it. */
export function formFromSession(
  existing: TutoringSession,
  assignments: Pick<Assignment, 'id' | 'tutor_user_id' | 'student_user_id'>[],
  userId: string | undefined,
): SessionFormValues {
  const match = assignments.find(
    (a) => a.tutor_user_id === existing.tutor_user_id && a.student_user_id === existing.student_user_id,
  );
  const mine = existing.assessments.find((row) => row.author_user_id === userId);
  const writeUp = existing.write_up;
  return {
    assignmentId: match?.id ?? '',
    occurredOn: existing.occurred_on,
    startedAt: existing.started_at,
    endedAt: existing.ended_at,
    mode: existing.mode,
    notes: existing.notes ?? '',
    planned: writeUp?.planned ?? '',
    previousReview: writeUp?.previous_review ?? '',
    homeworkReview: writeUp?.homework_review ?? '',
    homeworkStatus: writeUp?.homework_status ?? null,
    homeworkAssigned: writeUp?.homework_assigned ?? '',
    goalRating: existing.progress?.goal_rating ?? null,
    topicRatings: Object.fromEntries(
      (existing.progress?.topic_ratings ?? []).map((row) => [row.topic_id, row.rating]),
    ),
    myRating: mine?.rating ?? null,
    myAssessment: mine?.body ?? '',
  };
}

/** Every part of the write-up; the API stores none of it when all are empty. */
export function writeUpBody(v: SessionFormValues) {
  return {
    planned: v.planned.trim() || null,
    previous_review: v.previousReview.trim() || null,
    homework_review: v.homeworkReview.trim() || null,
    homework_status: v.homeworkStatus,
    homework_assigned: v.homeworkAssigned.trim() || null,
  };
}

/**
 * Only sent when there is something to say: a lesson scored for the first time, or an existing
 * score being changed or cleared. Otherwise the lesson is recorded with no progress row at all.
 */
export function progressBody(v: SessionFormValues, hadProgress: boolean) {
  const topics = Object.entries(v.topicRatings);
  if (v.goalRating === null && topics.length === 0 && !hadProgress) return undefined;
  return {
    goal_rating: v.goalRating,
    topic_ratings: topics.map(([topic_id, rating]) => ({ topic_id, rating })),
  };
}

/** The writer's own assessment, or undefined when they gave none. */
export function assessmentBody(v: SessionFormValues) {
  return v.myRating !== null || v.myAssessment.trim()
    ? { rating: v.myRating, body: v.myAssessment.trim() || null }
    : undefined;
}

/** Everything the form is holding, in the shape both the draft and the session endpoints take. */
export function formBody(
  v: SessionFormValues,
  pair: { tutor_user_id: string; student_user_id: string },
  hadProgress = false,
) {
  const progress = progressBody(v, hadProgress);
  const assessment = assessmentBody(v);
  return {
    tutor_user_id: pair.tutor_user_id,
    student_user_id: pair.student_user_id,
    occurred_on: v.occurredOn,
    started_at: v.startedAt,
    ended_at: v.endedAt,
    mode: v.mode,
    notes: v.notes.trim() || null,
    ...(progress ? { progress } : {}),
    write_up: writeUpBody(v),
    ...(assessment ? { assessment } : {}),
  };
}

/** A correction to a lesson on the record. Emptying the assessment withdraws one given before. */
export function toUpdatePayload(
  v: SessionFormValues,
  existing: TutoringSession,
  userId: string | undefined,
): SessionUpdatePayload {
  const progress = progressBody(v, Boolean(existing.progress));
  const assessment = assessmentBody(v);
  const hadMine = existing.assessments.some((row) => row.author_user_id === userId);
  return {
    occurred_on: v.occurredOn,
    started_at: v.startedAt,
    ended_at: v.endedAt,
    mode: v.mode,
    notes: v.notes.trim() || null,
    ...(progress ? { progress } : {}),
    write_up: writeUpBody(v),
    ...(assessment ? { assessment } : hadMine ? { assessment: null } : {}),
  } as SessionUpdatePayload;
}

/** Adds minutes to an HH:MM time, clamped to the same day. */
export function addMinutes(time: string, minutes: number): string {
  const start = parseClockTime(time);
  if (start === null) return time;
  const end = Math.min(start + minutes, 23 * 60 + 59);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** Zod issues as the server's field errors are keyed: the path joined with dots, first one wins. */
export function issuesToErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form';
    errors[key] ??= issue.message;
  }
  return errors;
}

/** The form's state: one object, one setter per field. */
export function useSessionForm(initial: () => SessionFormValues) {
  const [values, setValues] = useState(initial);
  const set = useCallback(
    <K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) =>
      setValues((before) => ({ ...before, [key]: value })),
    [],
  );
  return { values, set, setValues };
}
