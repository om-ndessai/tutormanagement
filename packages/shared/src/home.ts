import type { Location } from './locations.js';
import type { HomeworkStatus, SessionAssessment } from './session-notes.js';
import { formatClockTime, type SessionMode } from './teaching.js';
import { addDays, weekdayOf } from './schedules.js';
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

// ---------------------------------------------------------------------------
// The member home (Phase 66, docs/member-home-plan.md H1-H4, H9, H11)
// ---------------------------------------------------------------------------
// One home for everyone, built from the same blocks: a band, ONE "Next up"
// card, quick actions and a section per hat. A hat exists only with content:
// tutor (a pairing in force as the tutor), office (an admin of a space that is
// not personal), parent (a live child here) and learner (a student, or anyone
// who plays where there is no Tutoring). Nothing on it carries money.

export const HOME_HATS = ['tutor', 'office', 'parent', 'learner'] as const;
export type HomeHat = (typeof HOME_HATS)[number];

export const HOME_HAT_LABELS: Record<HomeHat, string> = {
  tutor: 'Your teaching',
  office: 'Needs you',
  parent: 'Your children',
  learner: 'Practice',
};

/** A lesson starts showing "Start" this many minutes before it begins (one constant for web and app). */
export const START_LEAD_MINUTES = 15;
/** How far back a scheduled lesson that was never recorded is flagged under "to record". */
export const UNRECORDED_LOOKBACK_DAYS = 7;

/** A lesson of a schedule, dated, as the member home names it. */
export interface HomeLesson {
  schedule_id: string;
  occurs_on: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
  student_user_id: string;
  student_name: string;
  tutor_user_id: string;
  tutor_name: string;
  /** Minutes from now until it starts on the space's clock; negative once under way. */
  starts_in: number;
}

export interface HomeTutor {
  /** Phase 43's Now card: a lesson just ended and not recorded, else the next lesson, and its brief. */
  now: TutorHome;
  /** Minutes until `now.next` starts (negative while under way); null without a next lesson. */
  next_starts_in: number | null;
  lessons_today: number;
  lessons_this_week: number;
  /** Lessons of the last UNRECORDED_LOOKBACK_DAYS that ended and were never recorded or cancelled, latest first (at most 5). */
  to_record: (TutorHomeLesson & { homework_last: string | null })[];
  to_record_count: number;
  /** Work waiting for this tutor: assessments submitted and not reviewed, Quest answers to review. */
  reviews: { assessments: number; quest: number };
}

export interface HomeOffice {
  /** Every tutor's lessons of the last UNRECORDED_LOOKBACK_DAYS never recorded (a count and the first few). */
  to_record_count: number;
  to_record: { occurs_on: string; start_time: string; student_name: string; tutor_name: string }[];
  /** People asking to join with the code, and invitations not yet accepted. */
  join_requests: number;
  invitations: number;
  lessons_today: number;
  lessons_this_week: number;
}

export interface HomeChild {
  student_user_id: string;
  first_name: string;
  /** The child's next lesson (not cancelled), or null. */
  next_lesson: HomeLesson | null;
  /** A lesson of theirs cancelled from today on, before or instead of the next one. */
  cancelled: { occurs_on: string; start_time: string; tutor_name: string } | null;
  /** The homework set at their last lesson, and when that was. */
  homework: string | null;
  last_lesson_on: string | null;
  lessons_this_month: number;
}

export interface HomeLearner {
  /** Their own next lesson, where they have lessons. */
  next_lesson: HomeLesson | null;
  /** Their own assessment under way (to continue), and their latest reviewed one. */
  assessment_in_progress: { id: string; level_id: string; started_at: string } | null;
  assessment_reviewed: { id: string; level_id: string; reviewed_at: string } | null;
}

export interface MemberHome {
  /** Today on the space's clock, and "morning"/"afternoon"/"evening" for the greeting. */
  day: string;
  part_of_day: PartOfDay;
  first_name: string;
  /** The hats this person wears here, in the base order (orderHats puts today's first). */
  hats: HomeHat[];
  personal: boolean;
  /** False for a teen (13-17): adding people is for adults (Phase 63), so no such action is offered. */
  may_bring_people: boolean;
  tutor: HomeTutor | null;
  office: HomeOffice | null;
  parent: { children: HomeChild[] } | null;
  learner: HomeLearner | null;
}

// --- Next up (H2) ------------------------------------------------------------

/** What only the device knows: a game invite (the waiting poll), the last quest played here, today's Daily. */
export interface NextUpExtras {
  game_invite?: { game_id: string; title: string; host_first_name: string } | null;
  continue_quest?: { code: string; title: string } | null;
  daily?: { level_id: string; done: boolean } | null;
  /** Phase 67: a student's Question Quest has a question waiting (it replaces the old landing redirect). */
  question_quest?: { level_id: string | null } | null;
  /** Phase 67 (H8): back after a week or more away (`welcome_back` in the habit summary). */
  welcome_back?: boolean;
}

export type NextUp =
  | { kind: 'lesson_unrecorded'; hat: 'tutor'; lesson: TutorHomeLesson & { homework_last: string | null } }
  | { kind: 'lesson_now'; hat: 'tutor'; lesson: TutorHomeLesson; starts_in: number }
  | { kind: 'child_change'; hat: 'parent'; child: HomeChild }
  | { kind: 'game_invite'; hat: 'learner'; game: NonNullable<NextUpExtras['game_invite']> }
  | { kind: 'reviews_waiting'; hat: 'tutor'; assessments: number; quest: number }
  | { kind: 'assessment_continue'; hat: 'learner'; assessment: NonNullable<HomeLearner['assessment_in_progress']> }
  | { kind: 'office_to_record'; hat: 'office'; office: HomeOffice }
  | { kind: 'question_quest'; hat: 'learner'; level_id: string | null }
  | { kind: 'daily'; hat: 'learner'; level_id: string }
  | { kind: 'welcome_back'; hat: 'learner'; level_id: string | null }
  | { kind: 'continue_quest'; hat: 'learner'; code: string; title: string }
  | { kind: 'learner_lesson'; hat: 'learner'; lesson: HomeLesson }
  | { kind: 'child_next_lesson'; hat: 'parent'; child: HomeChild }
  | { kind: 'office_needs'; hat: 'office'; office: HomeOffice }
  | { kind: 'lesson_next'; hat: 'tutor'; lesson: TutorHomeLesson; starts_in: number | null };

export type NextUpKind = NextUp['kind'];

/** The order Next up is chosen in: time-bound first (H2). */
export const NEXT_UP_ORDER: readonly NextUpKind[] = [
  'lesson_unrecorded',
  'lesson_now',
  'child_change',
  'game_invite',
  'reviews_waiting',
  'assessment_continue',
  'question_quest',
  'office_to_record',
  'daily',
  'welcome_back',
  'continue_quest',
  'learner_lesson',
  'child_next_lesson',
  'office_needs',
  'lesson_next',
];

/** A stable key per item, so "Later" can put one off for the day. */
export function nextUpKey(item: NextUp): string {
  switch (item.kind) {
    case 'lesson_unrecorded':
    case 'lesson_now':
    case 'lesson_next':
      return `${item.kind}:${item.lesson.schedule_id}:${item.lesson.occurs_on}`;
    case 'child_change':
    case 'child_next_lesson':
      return `${item.kind}:${item.child.student_user_id}`;
    case 'game_invite':
      return `${item.kind}:${item.game.game_id}`;
    case 'assessment_continue':
      return `${item.kind}:${item.assessment.id}`;
    case 'daily':
      return `${item.kind}:${item.level_id}`;
    case 'continue_quest':
      return `${item.kind}:${item.code}`;
    case 'learner_lesson':
      return `${item.kind}:${item.lesson.schedule_id}:${item.lesson.occurs_on}`;
    default:
      return item.kind;
  }
}

/** Every candidate for Next up, in NEXT_UP_ORDER. */
export function nextUpCandidates(home: MemberHome, extras: NextUpExtras = {}): NextUp[] {
  const out: NextUp[] = [];
  const t = home.tutor;
  if (t) {
    for (const lesson of t.now.unrecorded) out.push({ kind: 'lesson_unrecorded', hat: 'tutor', lesson });
    if (t.now.next && t.next_starts_in !== null && t.next_starts_in <= START_LEAD_MINUTES) {
      out.push({ kind: 'lesson_now', hat: 'tutor', lesson: t.now.next, starts_in: t.next_starts_in });
    }
  }
  for (const child of home.parent?.children ?? []) {
    if (child.cancelled) out.push({ kind: 'child_change', hat: 'parent', child });
  }
  if (extras.game_invite) out.push({ kind: 'game_invite', hat: 'learner', game: extras.game_invite });
  if (t && t.reviews.assessments + t.reviews.quest > 0) {
    out.push({ kind: 'reviews_waiting', hat: 'tutor', assessments: t.reviews.assessments, quest: t.reviews.quest });
  }
  if (home.learner?.assessment_in_progress) {
    out.push({ kind: 'assessment_continue', hat: 'learner', assessment: home.learner.assessment_in_progress });
  }
  if (home.office && home.office.to_record_count > 0) out.push({ kind: 'office_to_record', hat: 'office', office: home.office });
  if (extras.question_quest) out.push({ kind: 'question_quest', hat: 'learner', level_id: extras.question_quest.level_id });
  if (extras.daily && !extras.daily.done) out.push({ kind: 'daily', hat: 'learner', level_id: extras.daily.level_id });
  if (extras.welcome_back) out.push({ kind: 'welcome_back', hat: 'learner', level_id: extras.daily?.level_id ?? null });
  if (extras.continue_quest) {
    out.push({ kind: 'continue_quest', hat: 'learner', code: extras.continue_quest.code, title: extras.continue_quest.title });
  }
  if (home.learner?.next_lesson) out.push({ kind: 'learner_lesson', hat: 'learner', lesson: home.learner.next_lesson });
  for (const child of home.parent?.children ?? []) {
    if (child.next_lesson) out.push({ kind: 'child_next_lesson', hat: 'parent', child });
  }
  if (home.office && home.office.join_requests + home.office.invitations > 0) {
    out.push({ kind: 'office_needs', hat: 'office', office: home.office });
  }
  if (t?.now.next) out.push({ kind: 'lesson_next', hat: 'tutor', lesson: t.now.next, starts_in: t.next_starts_in });
  const rank = (item: NextUp) => NEXT_UP_ORDER.indexOf(item.kind);
  return out.sort((a, b) => rank(a) - rank(b));
}

/**
 * The one Next up: the first candidate not put off today. Within one kind, the
 * hat that comes first for this person wins (candidates keep their hat order).
 */
export function chooseNextUp(candidates: NextUp[], putOff: ReadonlySet<string> = new Set()): NextUp | null {
  return candidates.find((item) => !putOff.has(nextUpKey(item))) ?? null;
}

/** Whether a hat has something TODAY: such hats come first (H3). */
export function hatHasToday(home: MemberHome, hat: HomeHat): boolean {
  switch (hat) {
    case 'tutor':
      return Boolean(home.tutor && (home.tutor.lessons_today > 0 || home.tutor.now.unrecorded.length > 0));
    case 'office':
      return Boolean(home.office && home.office.to_record_count + home.office.join_requests > 0);
    case 'parent':
      return (home.parent?.children ?? []).some(
        (c) => c.cancelled !== null || c.next_lesson?.occurs_on === home.day,
      );
    case 'learner':
      return Boolean(
        home.learner &&
          (home.learner.assessment_in_progress !== null || home.learner.next_lesson?.occurs_on === home.day),
      );
  }
}

/** The hats in the order shown: those with something today first, each group in the base order. */
export function orderHats(home: MemberHome): HomeHat[] {
  const today = home.hats.filter((hat) => hatHasToday(home, hat));
  return [...today, ...home.hats.filter((hat) => !today.includes(hat))];
}

/** The quick actions (at most 3), most useful first, for the hats worn and what this person may do. */
export const QUICK_ACTIONS = [
  'record_lesson',
  'start_lesson',
  'new_quest',
  'join_code',
  'start_assessment',
  'add_person',
  'schedule',
  'progress',
] as const;
export type QuickAction = (typeof QUICK_ACTIONS)[number];

export function quickActionsFor(
  hats: readonly HomeHat[],
  options: { tutoring: boolean; quest: boolean; assessment: boolean; mayBringPeople: boolean },
): QuickAction[] {
  const out: QuickAction[] = [];
  const add = (action: QuickAction) => {
    if (!out.includes(action)) out.push(action);
  };
  for (const hat of hats) {
    if (hat === 'tutor') {
      add('record_lesson');
      add('start_lesson');
    } else if (hat === 'office') {
      if (options.mayBringPeople) add('add_person');
      if (options.tutoring) add('schedule');
    } else if (hat === 'parent') {
      // Schedules and progress are Tutoring's pages.
      if (options.tutoring) {
        add('schedule');
        add('progress');
      }
    } else {
      if (options.quest) add('new_quest');
      if (options.quest) add('join_code');
      if (options.assessment) add('start_assessment');
    }
  }
  return out.slice(0, 3);
}

/** "Good morning, Alex". */
export function homeGreeting(home: Pick<MemberHome, 'part_of_day' | 'first_name'>): string {
  return `Good ${home.part_of_day}, ${home.first_name}`;
}

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


const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A day in words from `today`: "today", "tomorrow", "yesterday", "Thu" within the week, else "Thu, Nov 5". */
export function dayInWords(date: string, today: string): string {
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  if (date === addDays(today, -1)) return 'yesterday';
  const weekday = WEEKDAYS[weekdayOf(date)] ?? '';
  if (date > today && date <= addDays(today, 6)) return weekday;
  return `${weekday}, ${MONTHS[Number(date.slice(5, 7)) - 1] ?? ''} ${Number(date.slice(8, 10))}`;
}

/** "today at 4:00 PM", "Thu at 5:00 PM". */
export function lessonWhen(occursOn: string, startTime: string, today: string): string {
  return `${dayInWords(occursOn, today)} at ${formatClockTime(startTime)}`;
}

/** "in 10 min", "in 2 h", "under way". */
export function startsInWords(minutes: number): string {
  if (minutes <= 0) return 'under way';
  if (minutes < 60) return `in ${minutes} min`;
  return `in ${Math.round(minutes / 60)} h`;
}
