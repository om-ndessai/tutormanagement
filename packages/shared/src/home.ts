import type { Location } from './locations.js';
import type { HomeworkStatus, SessionAssessment } from './session-notes.js';
import type { SessionMode } from './teaching.js';
import type { Rating } from './progress.js';

// ---------------------------------------------------------------------------
// The tutor's Home (Phase 43, docs/tutor-home-plan.md)
// ---------------------------------------------------------------------------
// What a tutor -- or an admin who tutors -- sees first: the "Now" card (a
// lesson just finished and not recorded; else their next lesson) and the brief
// for that next lesson (the homework set last time, where it is, the next
// topic on the plan, the last lesson's assessment notes). Only their own
// pairings; nothing here carries money.

/** One lesson of a tutor's own schedules, dated. */
export interface TutorHomeLesson {
  schedule_id: string;
  occurs_on: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  student_user_id: string;
  student_name: string;
  /** The schedule's place for this lesson's mode (a physical address, or a meeting link). */
  place: Location | null;
  /** Lessons this pairing has recorded, and the date of the first ("24 together since August"). */
  lessons_together: number;
  together_since: string | null;
}

/** What to know before the next lesson. */
export interface TutorHomeBrief {
  /** The pairing's last recorded lesson, or null before the first. */
  last_lesson: { session_id: string; occurred_on: string } | null;
  /** The homework set at the last lesson, and how the homework before it went. */
  homework: { assigned: string | null; status_before: HomeworkStatus | null } | null;
  /** The first topic of the student's active plan not yet mastered. */
  next_topic: {
    topic_id: string;
    code: string;
    name: string;
    description: string | null;
    current: Rating | null;
    plan_target_on: string;
  } | null;
  /** Every assessment on the last lesson the tutor can read: their own, the student's, a parent's. */
  assessments: SessionAssessment[];
}

export interface TutorHome {
  /** "morning" | "afternoon" | "evening", on the organization's clock, for the greeting. */
  part_of_day: PartOfDay;
  /** Lessons that ended in the last 24 hours and are not recorded (nor cancelled, nor running), latest first. */
  unrecorded: (TutorHomeLesson & { homework_last: string | null })[];
  /** The next lesson that is not cancelled (it may be under way). */
  next: TutorHomeLesson | null;
  /** The brief for `next`. */
  brief: TutorHomeBrief | null;
}

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

/** Morning until noon, afternoon until 5 PM, evening after. */
export function partOfDay(minutesOfDay: number): PartOfDay {
  if (minutesOfDay < 12 * 60) return 'morning';
  if (minutesOfDay < 17 * 60) return 'afternoon';
  return 'evening';
}

/**
 * A place's address as a Google Maps search link: opens the Google Maps app
 * where it is installed, else maps in the browser. No API key, no location.
 */
export function googleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
