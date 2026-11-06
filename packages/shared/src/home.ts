import { z } from 'zod';
import type { Location } from './locations.js';
import type { HomeworkStatus, SessionAssessment } from './session-notes.js';
import { formatClockTime, type LessonDraftRef, type SessionMode } from './teaching.js';
import { addDays, weekdayOf } from './schedules.js';
import type { Rating } from './progress.js';
import type { CreateGameRequest } from './quest-games.js';

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
  /**
   * Lessons that ended in the last 24 hours and are not recorded (nor cancelled, nor running), latest first.
   * Phase 75 (JF19): on the member home each carries the reader's own draft of it (`draft`, R10).
   */
  unrecorded: TutorUnrecordedLesson[];
  /** The next lesson that is not cancelled (it may be under way). */
  next: TutorHomeLesson | null;
  /** The brief for `next`. */
  brief: TutorHomeBrief | null;
}

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

/** A lesson still to record, as the tutor's Home and the member home list it. */
export type TutorUnrecordedLesson = TutorHomeLesson & {
  homework_last: string | null;
  /**
   * Phase 75 (JF19): the reader's own draft of this lesson (same tutor, student and date; the newest), so "Record"
   * continues it ("Draft saved 12:43 PM · Continue") instead of starting a second one. Only the member home
   * (`GET /api/home`) fills it; null for none; absent from an older Worker and from `GET /api/home/tutor`.
   */
  draft?: LessonDraftRef | null;
};

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
  learner: 'Your learning',
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
  /**
   * Phase 74 (JF17): where it is -- the schedule's location of its kind, by NAME only (never an address or a link, R16,
   * R29). Absent from an older Worker; null when the schedule names none.
   */
  place?: { name: string; kind: 'physical' | 'virtual' } | null;
}

export interface HomeTutor {
  /** Phase 43's Now card: a lesson just ended and not recorded, else the next lesson, and its brief. */
  now: TutorHome;
  /** Minutes until `now.next` starts (negative while under way); null without a next lesson. */
  next_starts_in: number | null;
  lessons_today: number;
  lessons_this_week: number;
  /**
   * Lessons of the last UNRECORDED_LOOKBACK_DAYS that ended and were never recorded or cancelled, latest first (at most
   * 5); each with the reader's own draft of it (Phase 75, JF19). The whole list is `GET /api/sessions/to-record`.
   */
  to_record: TutorUnrecordedLesson[];
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
  /** Phase 74 (JF6): assessments submitted and not yet reviewed, where Assessment is on. A count (R29). */
  assessments_open?: number;
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
  /**
   * Phase 68 (H10, R29): this week's days played (0-7) and whether today's Daily is done -- counts
   * only, never a score or an answer. Null where Quest is off. Absent from an older Worker.
   */
  days_played_this_week?: number | null;
  daily_done_today?: boolean | null;
  /** The level the child played last (a game or a Daily), for "Play with <child>"; null if none. */
  play_level_id?: string | null;
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
  /**
   * Whether the reader has someone to start an assessment for here (a student they may follow, or themselves
   * in a personal space). False: no "Start an assessment" is offered -- a parent let in with no child once
   * met it as a dead end (UI audit JF1, J07). Absent from older Workers: treat as true.
   */
  may_assess?: boolean;
  tutor: HomeTutor | null;
  office: HomeOffice | null;
  parent: { children: HomeChild[] } | null;
  learner: HomeLearner | null;
  /**
   * Phase 68 (H4): what leads this home -- the person's pin, else what they did most in the last
   * HOME_FOCUS_ACTIVITY_DAYS days, else how they arrived, else their roles (`deriveHomeFocus`).
   * Absent from an older Worker.
   */
  focus?: HomeFocus;
  /** "Make this my home": the person's own choice in this space, or null for automatic. */
  pin?: HomeFocus | null;
  /** The focuses this person may pin here. */
  focus_options?: HomeFocus[];
}

// --- Focus (H4, Phase 68) ------------------------------------------------------

/** What a home can lead with. */
export const HOME_FOCUSES = ['quest', 'assessment', 'tutoring', 'family', 'office'] as const;
export type HomeFocus = (typeof HOME_FOCUSES)[number];

export const HOME_FOCUS_LABELS: Record<HomeFocus, string> = {
  quest: 'Quest',
  assessment: 'Assessments',
  tutoring: 'Teaching',
  family: 'My children',
  office: 'Running the space',
};

/** The hat a focus brings to the top. */
export const FOCUS_HAT: Record<HomeFocus, HomeHat> = {
  quest: 'learner',
  assessment: 'learner',
  tutoring: 'tutor',
  family: 'parent',
  office: 'office',
};

/** PUT /api/home/pin: "Make this my home", or null for automatic. */
export const homePinSchema = z.object({ focus: z.enum(HOME_FOCUSES).nullable() });
export type HomePinInput = z.infer<typeof homePinSchema>;

/** How a person arrived, as the sign-up sheet knew it (`platform_accounts.arrived_via`). */
export const ARRIVALS = ['guest_quest', 'guest_assessment', 'direct'] as const;
export type Arrival = (typeof ARRIVALS)[number];

/**
 * How a newcomer arrived, from what the guest's device played (most recent first, tile codes): the guest
 * Assessment, a guest quest, or neither. Only this one word is sent -- never the tiles, grade or scores.
 */
export function arrivalFromGuest(played: readonly string[]): Arrival {
  const last = played[0];
  if (!last) return 'direct';
  return /^[A-Z0-9]+A\d+$/.test(last) ? 'guest_assessment' : 'guest_quest';
}

/** How far back "what they did most" looks. */
export const HOME_FOCUS_ACTIVITY_DAYS = 14;
/** Days of an activity in that window before it counts as what they do. */
export const HOME_FOCUS_MIN_DAYS = 2;

/** Days with each activity in the last HOME_FOCUS_ACTIVITY_DAYS: quests played, assessments, lessons recorded. */
export interface HomeActivity {
  quest: number;
  assessment: number;
  tutoring: number;
}

/** The focuses a person may have here: what their hats and the space's feature sets allow. */
export function homeFocusOptions(hats: readonly HomeHat[], sets: { quest: boolean; assessment: boolean }): HomeFocus[] {
  const out: HomeFocus[] = [];
  if (sets.quest) out.push('quest');
  if (sets.assessment) out.push('assessment');
  if (hats.includes('tutor')) out.push('tutoring');
  if (hats.includes('parent')) out.push('family');
  if (hats.includes('office')) out.push('office');
  return out;
}

/**
 * The focus (H4), first to last: the pin; what they did most in the last 14 days (at least
 * HOME_FOCUS_MIN_DAYS days of it); how they arrived; the hat that leads by their roles.
 */
export function deriveHomeFocus(input: {
  pin: HomeFocus | null;
  activity: HomeActivity;
  arrived_via: Arrival | null;
  hats: readonly HomeHat[];
  options: readonly HomeFocus[];
}): HomeFocus {
  const { pin, activity, arrived_via, hats, options } = input;
  const allowed = (focus: HomeFocus | null): focus is HomeFocus => focus !== null && options.includes(focus);
  if (allowed(pin)) return pin;
  const ranked = (['tutoring', 'assessment', 'quest'] as const)
    .filter((focus) => allowed(focus) && activity[focus] >= HOME_FOCUS_MIN_DAYS)
    .sort((a, b) => activity[b] - activity[a]);
  if (ranked[0]) return ranked[0];
  // Phase 74 (JF6, owner 2026-11-05): a parent's or the office's hat, where it leads, beats how they first arrived --
  // a parent invited for a child, or someone who started a space, came for that, whatever they played as a guest.
  const lead0 = hats[0];
  const early: HomeFocus | null = lead0 === 'parent' ? 'family' : lead0 === 'office' ? 'office' : null;
  if (allowed(early)) return early;
  const arrived: HomeFocus | null =
    arrived_via === 'guest_quest' ? 'quest' : arrived_via === 'guest_assessment' ? 'assessment' : null;
  if (allowed(arrived)) return arrived;
  const lead = hats[0];
  const byHat: HomeFocus | null =
    lead === 'tutor' ? 'tutoring' : lead === 'parent' ? 'family' : lead === 'office' ? 'office' : options.includes('quest') ? 'quest' : 'assessment';
  if (allowed(byHat)) return byHat;
  return options[0] ?? 'quest';
}

// --- Families (H10, Phase 68) --------------------------------------------------

/** "Play with <child>": a game of two, each on their own, the parent playing, the child invited. */
export function playWithRequest(levelId: string, childUserId: string): CreateGameRequest {
  return {
    level_id: levelId as CreateGameRequest['level_id'],
    mode: 'count',
    question_count: 5,
    players: 'multi',
    max_teams: 2,
    max_team_size: 1,
    late_join: true,
    host_plays: true,
    invite_user_ids: [childUserId],
  };
}

/** A quick practice of five on one's own (Practise before a lesson). */
export function practiseRequest(levelId: string): CreateGameRequest {
  return { level_id: levelId as CreateGameRequest['level_id'], mode: 'count', question_count: 5, players: 'single', max_team_size: 1 };
}

/** How many days ahead a lesson prompts "Practise before <day>'s lesson": the week before (owner, 2026-11-05; JF17). */
export const PRACTISE_BEFORE_DAYS = 7;

/**
 * Whether a lesson is close enough to practise for: later today, or in the coming week -- strictly less than
 * PRACTISE_BEFORE_DAYS ahead, so "Thursday's lesson" is never said on a Thursday of a lesson a week away.
 */
export function practiseBefore(lesson: Pick<HomeLesson, 'occurs_on' | 'starts_in'> | null, today: string): boolean {
  if (!lesson) return false;
  if (lesson.occurs_on === today) return lesson.starts_in > 60;
  return lesson.occurs_on > today && lesson.occurs_on < addDays(today, PRACTISE_BEFORE_DAYS);
}

/** "Thursday's lesson", "tomorrow's lesson", "today's lesson". */
export function lessonDayWords(occursOn: string, today: string): string {
  if (occursOn === today || occursOn === addDays(today, 1)) return `${dayInWords(occursOn, today)}'s lesson`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[weekdayOf(occursOn)] ?? dayInWords(occursOn, today)}'s lesson`;
}

// --- Next up (H2) ------------------------------------------------------------

/** What only the device knows: a game invite (the waiting poll), the last quest played here, today's Daily. */
export interface NextUpExtras {
  game_invite?: { game_id: string; title: string; host_first_name: string } | null;
  continue_quest?: { code: string; title: string } | null;
  /** Phase 73 (JF13): the reader's open game here, from the server; it outranks "again". */
  open_game?: { game_id: string; title: string } | null;
  daily?: { level_id: string; done: boolean } | null;
  /** Phase 67: a student's Question Quest has a question waiting (it replaces the old landing redirect). */
  question_quest?: { level_id: string | null } | null;
  /** Phase 67 (H8): back after a week or more away (`welcome_back` in the habit summary). */
  welcome_back?: boolean;
  /** Phase 68: the level a learner's practice starts at (the board's lead), and whether they played today. */
  practice_level_id?: string | null;
  played_today?: boolean;
  /**
   * Phase 75 (JF30): the reader's lesson running now, from the client's own `GET /api/sessions/active` (`mine`); it
   * leads Next up, with Stop. Absent or null: none.
   */
  running?: { student_name: string; started_at: string; mode: SessionMode } | null;
}

export type NextUp =
  | { kind: 'lesson_running'; hat: 'tutor'; running: NonNullable<NextUpExtras['running']> }
  | { kind: 'lesson_unrecorded'; hat: 'tutor'; lesson: TutorUnrecordedLesson }
  | { kind: 'lesson_now'; hat: 'tutor'; lesson: TutorHomeLesson; starts_in: number }
  | { kind: 'child_change'; hat: 'parent'; child: HomeChild }
  | { kind: 'game_invite'; hat: 'learner'; game: NonNullable<NextUpExtras['game_invite']> }
  | { kind: 'open_game'; hat: 'learner'; game: NonNullable<NextUpExtras['open_game']> }
  | { kind: 'reviews_waiting'; hat: 'tutor'; assessments: number; quest: number }
  | { kind: 'assessment_continue'; hat: 'learner'; assessment: NonNullable<HomeLearner['assessment_in_progress']> }
  | { kind: 'office_to_record'; hat: 'office'; office: HomeOffice }
  | { kind: 'question_quest'; hat: 'learner'; level_id: string | null }
  | { kind: 'practise_before'; hat: 'learner'; lesson: HomeLesson; level_id: string }
  | { kind: 'daily'; hat: 'learner'; level_id: string }
  | { kind: 'welcome_back'; hat: 'learner'; level_id: string | null }
  | { kind: 'continue_quest'; hat: 'learner'; code: string; title: string }
  | { kind: 'learner_lesson'; hat: 'learner'; lesson: HomeLesson }
  | { kind: 'child_next_lesson'; hat: 'parent'; child: HomeChild }
  | { kind: 'office_needs'; hat: 'office'; office: HomeOffice }
  | { kind: 'lesson_next'; hat: 'tutor'; lesson: TutorHomeLesson; starts_in: number | null }
  | { kind: 'focus_default'; hat: HomeHat; focus: 'quest' | 'assessment' };

export type NextUpKind = NextUp['kind'];

/** The order Next up is chosen in: time-bound first (H2). */
export const NEXT_UP_ORDER: readonly NextUpKind[] = [
  'lesson_running',
  'lesson_unrecorded',
  'lesson_now',
  'child_change',
  'game_invite',
  'open_game',
  'reviews_waiting',
  'assessment_continue',
  'question_quest',
  'office_to_record',
  'practise_before',
  'daily',
  'welcome_back',
  'continue_quest',
  'learner_lesson',
  'child_next_lesson',
  'office_needs',
  'lesson_next',
  'focus_default',
];

/** A stable key per item, so "Later" can put one off for the day. */
export function nextUpKey(item: NextUp): string {
  switch (item.kind) {
    case 'lesson_running':
      return `${item.kind}:${item.running.started_at}`;
    case 'lesson_unrecorded':
    case 'lesson_now':
    case 'lesson_next':
      return `${item.kind}:${item.lesson.schedule_id}:${item.lesson.occurs_on}`;
    case 'child_change':
    case 'child_next_lesson':
      return `${item.kind}:${item.child.student_user_id}`;
    case 'game_invite':
    case 'open_game':
      return `${item.kind}:${item.game.game_id}`;
    case 'assessment_continue':
      return `${item.kind}:${item.assessment.id}`;
    case 'daily':
      return `${item.kind}:${item.level_id}`;
    case 'continue_quest':
      return `${item.kind}:${item.code}`;
    case 'learner_lesson':
    case 'practise_before':
      return `${item.kind}:${item.lesson.schedule_id}:${item.lesson.occurs_on}`;
    case 'focus_default':
      return `${item.kind}:${item.focus}`;
    default:
      return item.kind;
  }
}

/** Every candidate for Next up, in NEXT_UP_ORDER. */
export function nextUpCandidates(home: MemberHome, extras: NextUpExtras = {}): NextUp[] {
  const out: NextUp[] = [];
  // Phase 75 (JF30): a lesson under way comes first, whatever the hats say -- only a tutor has one.
  if (extras.running) out.push({ kind: 'lesson_running', hat: 'tutor', running: extras.running });
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
  const learnerLesson = home.learner?.next_lesson ?? null;
  if (learnerLesson && extras.practice_level_id && !extras.played_today && practiseBefore(learnerLesson, home.day)) {
    out.push({ kind: 'practise_before', hat: 'learner', lesson: learnerLesson, level_id: extras.practice_level_id });
  }
  if (extras.daily && !extras.daily.done) out.push({ kind: 'daily', hat: 'learner', level_id: extras.daily.level_id });
  if (extras.welcome_back) out.push({ kind: 'welcome_back', hat: 'learner', level_id: extras.daily?.level_id ?? null });
  if (extras.open_game) out.push({ kind: 'open_game', hat: 'learner', game: extras.open_game });
  if (extras.continue_quest && !extras.open_game) {
    out.push({ kind: 'continue_quest', hat: 'learner', code: extras.continue_quest.code, title: extras.continue_quest.title });
  }
  if (home.learner?.next_lesson) out.push({ kind: 'learner_lesson', hat: 'learner', lesson: home.learner.next_lesson });
  for (const child of home.parent?.children ?? []) {
    if (child.next_lesson) out.push({ kind: 'child_next_lesson', hat: 'parent', child });
  }
  // Phase 74 (JF6): open assessments are the office's too, so Next up never says "all caught up" beside them.
  if (home.office && home.office.join_requests + home.office.invitations + (home.office.assessments_open ?? 0) > 0) {
    out.push({ kind: 'office_needs', hat: 'office', office: home.office });
  }
  if (t?.now.next) out.push({ kind: 'lesson_next', hat: 'tutor', lesson: t.now.next, starts_in: t.next_starts_in });
  // Phase 68 (H4): with nothing else, the focus's own first step -- only where that set is on here
  // (with every set off, the focus is a fallback, and offering it would open a page that answers 403).
  if (
    (home.focus === 'quest' || (home.focus === 'assessment' && home.may_assess !== false)) &&
    (home.focus_options ?? []).includes(home.focus)
  ) {
    out.push({ kind: 'focus_default', hat: 'learner', focus: home.focus });
  }
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
      return Boolean(
        home.office && home.office.to_record_count + home.office.join_requests + (home.office.assessments_open ?? 0) > 0,
      );
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

/**
 * The hats in the order shown: a pinned focus's hat first, always; then those with something today;
 * within each group the focus's hat leads (Phase 68, H4), then the base order.
 */
export function orderHats(home: MemberHome): HomeHat[] {
  const focusHat = home.focus ? FOCUS_HAT[home.focus] : null;
  const base = focusHat && home.hats.includes(focusHat) ? [focusHat, ...home.hats.filter((h) => h !== focusHat)] : [...home.hats];
  const today = base.filter((hat) => hatHasToday(home, hat));
  const ordered = [...today, ...base.filter((hat) => !today.includes(hat))];
  const pinnedHat = home.pin ? FOCUS_HAT[home.pin] : null;
  return pinnedHat && ordered.includes(pinnedHat) ? [pinnedHat, ...ordered.filter((h) => h !== pinnedHat)] : ordered;
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
  options: {
    tutoring: boolean;
    quest: boolean;
    assessment: boolean;
    mayBringPeople: boolean;
    /** MemberHome.may_assess: someone to start an assessment for (absent: true). */
    mayAssess?: boolean;
    /**
     * Phase 74 (JF23): the Quest board is on the home (it has its own New Quest), and the band's doors are shown (they
     * have their own Join with a code) -- left out BEFORE the cut to three, so the freed place is refilled.
     */
    board?: boolean;
    doors?: boolean;
    /**
     * Phase 76 (JF21): a personal space (`MemberHome.personal`). Its adult has no office hat there, yet needs a door to
     * add their child, so `add_person` is offered (where `mayBringPeople`) and kept within the three.
     */
    personal?: boolean;
  },
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
      if (options.quest && !options.board) add('new_quest');
      if (options.quest && !options.doors) add('join_code');
      if (options.assessment && options.mayAssess !== false) add('start_assessment');
    }
  }
  if (options.personal && options.mayBringPeople && !out.includes('add_person')) {
    return [...out.slice(0, 2), 'add_person'];
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
