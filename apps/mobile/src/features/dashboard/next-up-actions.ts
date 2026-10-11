// What the Home "Next up" card offers (ux-audit F-6, #43): the tutor's main job, starting the lesson
// that is about to happen, from where they already are. Pure, so the rules are tested without a
// device. Nothing here carries money: the card sits on the Tutoring tab.
import { parseClockTime, type UpcomingSession } from '@tmi/shared';

/** How long before its start a lesson may be started (or written up) from Home. */
export const START_LEAD_MINUTES = 60;

type Occurrence = Pick<
  UpcomingSession,
  | 'schedule_id'
  | 'occurs_on'
  | 'start_time'
  | 'end_time'
  | 'mode'
  | 'tutor_user_id'
  | 'student_user_id'
  | 'cancellation'
>;

/**
 * True while the lesson is "at hand": today on the organization's clock, from an hour before its
 * start until its end. (The upcoming list drops a lesson once it has ended.)
 */
export function lessonAtHand(occurrence: Occurrence, today: string, nowMinutes: number): boolean {
  if (occurrence.cancellation || occurrence.occurs_on !== today) return false;
  const start = parseClockTime(occurrence.start_time);
  const end = parseClockTime(occurrence.end_time);
  if (start === null || end === null) return false;
  return nowMinutes >= start - START_LEAD_MINUTES && nowMinutes < end;
}

export interface NextUpActions {
  start: boolean;
  record: boolean;
  cancel: boolean;
}

/**
 * Which buttons the card shows. The server decides everything again; this only hides what it would
 * refuse.
 *
 * - Start and Record: only the lesson's OWN tutor (the server starts a lesson as the caller, so an
 *   admin viewing a tutor's dashboard must not be offered it), only while it is at hand, and only
 *   with nothing running (the banner's Stop records that one).
 * - Cancel: the lesson's tutor or the office, who may call off any date of a series. A parent
 *   never sees this carousel.
 */
export function nextUpActions({
  occurrence,
  userId,
  isAdmin,
  running,
  today,
  nowMinutes,
}: {
  occurrence: Occurrence;
  userId: string | undefined;
  isAdmin: boolean;
  running: boolean;
  today: string;
  nowMinutes: number;
}): NextUpActions {
  const own = Boolean(userId) && occurrence.tutor_user_id === userId;
  const teachNow = own && !running && lessonAtHand(occurrence, today, nowMinutes);
  return {
    start: teachNow,
    record: teachNow,
    cancel: !occurrence.cancellation && (own || isAdmin),
  };
}

/** The Start sheet with the student and the schedule's mode already chosen. */
export function startHref(occurrence: Occurrence) {
  return {
    pathname: '/start-lesson' as const,
    params: { student: occurrence.student_user_id, mode: occurrence.mode },
  };
}

/** The record sheet with the pairing, the date, the times and the mode filled in. */
export function recordHref(occurrence: Occurrence) {
  return {
    pathname: '/record-session' as const,
    params: {
      student: occurrence.student_user_id,
      tutor: occurrence.tutor_user_id,
      date: occurrence.occurs_on,
      start: occurrence.start_time,
      end: occurrence.end_time,
      mode: occurrence.mode,
    },
  };
}

/** The cancel sheet for this one date of the series. */
export function cancelHref(occurrence: Occurrence) {
  return {
    pathname: '/cancel-lesson' as const,
    params: { schedule: occurrence.schedule_id, date: occurrence.occurs_on },
  };
}
