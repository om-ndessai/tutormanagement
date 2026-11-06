// The member home's words and choices (Phase 66, docs/member-home-plan.md H1-H4), pure so they are
// tested without a device. The rules themselves (which hats, their order, Next up, the quick actions) are
// the shared contract's (`packages/shared/src/home.ts`); this file only words them for the phone and
// gathers what only the device knows. Nothing here carries money.
//
// Phase 74 (docs/journey-fixes-plan.md, owner 2026-11-05): a lesson line says where it is ("Tue at 4:00 PM with Alex ·
// Institute, room 2", JF17); the band never repeats what Next up says and never leads with a zero -- a learner who has
// not played here gets three doors instead (JF6, JF16); office and parent lines say nothing about lessons where Tutoring
// is off; the office section says "Nothing needs you right now" rather than zero rows (JF6).
import {
  HOME_FOCUS_LABELS,
  STREAK_DAYS_PER_WEEK,
  lessonDayWords,
  lessonWhen,
  practiseBefore,
  startsInWords,
  type ActiveSession,
  type HomeChild,
  type HomeFocus,
  type HomeHat,
  type HomeLesson,
  type MemberHome,
  type NextUp,
  type NextUpExtras,
  type OpenGameResponse,
  type QuestState,
  type QuickAction,
  type TutorHomeLesson,
  type WaitingGame,
} from '@tmi/shared';

/** "Sofia" from "Sofia Okafor". */
export function firstOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim();
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function capitalise(text: string): string {
  return text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "Thu at 5:00 PM", "today at 4:00 PM" (the shared words, as the web's). */
export function whenWords(lesson: Pick<HomeLesson, 'occurs_on' | 'start_time'>, today: string): string {
  return lessonWhen(lesson.occurs_on, lesson.start_time, today);
}

/** Phase 74 (JF17): " · Institute, room 2" -- where a lesson is, by name only (never an address); "" without one. */
export function placeWords(lesson: Pick<HomeLesson, 'place'>): string {
  const name = lesson.place?.name?.trim();
  return name ? ` · ${name}` : '';
}

/** "Thu at 5:00 PM with Priya", and its place when the schedule names one: "… with Priya · Institute, room 2". */
export function lessonWithTutor(
  lesson: Pick<HomeLesson, 'occurs_on' | 'start_time' | 'tutor_name'> & Partial<Pick<HomeLesson, 'place'>>,
  today: string,
): string {
  return `${whenWords(lesson, today)} with ${firstOf(lesson.tutor_name)}${placeWords(lesson)}`;
}

/** "Thu at 5:00 PM with Sofia". */
export function lessonWithStudent(
  lesson: Pick<TutorHomeLesson, 'occurs_on' | 'start_time' | 'student_name'>,
  today: string,
): string {
  return `${whenWords(lesson, today)} with ${firstOf(lesson.student_name)}`;
}

/** "Today: 2 lessons · 1 to record". */
export function tutorStrip(tutor: NonNullable<MemberHome['tutor']>): string {
  const parts = [`Today: ${plural(tutor.lessons_today, 'lesson')}`];
  if (tutor.to_record_count > 0) parts.push(`${tutor.to_record_count} to record`);
  return parts.join(' · ');
}

/**
 * "3 to record · 2 invitations · 1 asking to join · 2 assessments to review", only the non-zero parts; else "All
 * caught up". Phase 74 (JF23): what Next up already says is left out (`skip`) -- each count once; with nothing else
 * left, no line (null), since Next up has said it.
 */
export function officeStrip(
  office: NonNullable<MemberHome['office']>,
  skip: 'to_record' | 'needs' | null = null,
): string | null {
  const parts: string[] = [];
  if (skip !== 'to_record' && office.to_record_count > 0) parts.push(`${office.to_record_count} to record`);
  if (skip !== 'needs') {
    if (office.invitations > 0) parts.push(plural(office.invitations, 'invitation'));
    if (office.join_requests > 0) parts.push(`${office.join_requests} asking to join`);
  }
  if ((office.assessments_open ?? 0) > 0) parts.push(`${plural(office.assessments_open!, 'assessment')} to review`);
  if (parts.length > 0) return parts.join(' · ');
  return skip ? null : 'All caught up';
}

/**
 * The parent's line for a child. Where Tutoring is on: "Sofia: next Tue at 4:00 PM · Institute, room 2" / "Sofia: no
 * lessons scheduled". Phase 74 (JF16): where Tutoring is off -- or Next up already names the lesson (`skipLesson`) --
 * nothing about lessons: the child's week of play, counts only ("Noor: played 2 days this week", "Noor: not played yet
 * this week"); where Quest is off too, "Noor: all caught up". Null when Next up has said everything.
 */
export function childStrip(
  child: HomeChild,
  today: string,
  { tutoring = true, skipLesson = false }: { tutoring?: boolean; skipLesson?: boolean } = {},
): string | null {
  if (tutoring && !skipLesson) {
    return child.next_lesson
      ? `${child.first_name}: next ${whenWords(child.next_lesson, today)}${placeWords(child.next_lesson)}`
      : `${child.first_name}: no lessons scheduled`;
  }
  const days = child.days_played_this_week;
  if (days != null) {
    return days > 0
      ? `${child.first_name}: played ${plural(days, 'day')} this week`
      : `${child.first_name}: not played yet this week`;
  }
  return tutoring ? null : `${child.first_name}: all caught up`;
}

/**
 * The learner's line: their next lesson (with its place), else the streak in words (where Quest is on: "Start a
 * streak", never "0 of 3 days"), else a calm word. Phase 74 (JF23): not the lesson while Next up names it.
 */
export function learnerStrip(
  learner: MemberHome['learner'],
  today: string,
  streak: string | null,
  skipLesson = false,
): string {
  if (learner?.next_lesson && !skipLesson) return `Next lesson: ${lessonWithTutor(learner.next_lesson, today)}`;
  return streak ?? 'Ready when you are';
}

/**
 * The band's one line, for the first hat of `orderHats` (null without a hat). Phase 74: never what Next up (`next`)
 * already says, and nothing about lessons where Tutoring is off (`tutoring`).
 */
export function stripLine(
  home: MemberHome,
  hat: HomeHat | undefined,
  streak: string | null,
  { next = null, tutoring = true }: { next?: NextUp | null; tutoring?: boolean } = {},
): string | null {
  switch (hat) {
    case 'tutor':
      return home.tutor ? tutorStrip(home.tutor) : null;
    case 'office':
      return home.office
        ? officeStrip(home.office, next?.kind === 'office_to_record' ? 'to_record' : next?.kind === 'office_needs' ? 'needs' : null)
        : null;
    case 'parent': {
      const child = home.parent?.children[0];
      if (!child) return tutoring ? 'No lessons scheduled' : null;
      const named =
        (next?.kind === 'child_next_lesson' || next?.kind === 'child_change') &&
        next.child.student_user_id === child.student_user_id;
      return childStrip(child, home.day, { tutoring, skipLesson: named });
    }
    case 'learner':
      return learnerStrip(
        home.learner,
        home.day,
        streak,
        next?.kind === 'learner_lesson' || next?.kind === 'practise_before',
      );
    default:
      return null;
  }
}

// --- Phase 74 (JF6, JF16): the first home's band -----------------------------------------------------

/** The band's line beside the doors: the streak to start, in words (the web's), never "0 of 3 days". */
export const NEWCOMER_STRIP = 'Start a streak: play on three days this week.';

/** The band's doors for a learner who has not played here yet: Play, Join with a code, and (adults) Start a space. */
export const BAND_DOORS = ['play', 'code', 'start'] as const;
export type BandDoor = (typeof BAND_DOORS)[number];

export const BAND_DOOR_LABELS: Record<BandDoor, string> = {
  play: 'Play',
  code: 'Join with a code',
  start: 'Start a space',
};

/**
 * Three doors instead of a zero (owner, 2026-11-05): only when the band speaks for a learner, where Quest is on, who
 * has never played here (`HabitSummary.played_before === false`; absent from an older Worker: no doors). "Start a
 * space" only for someone who may make one (shared `mayMakeSpace`).
 */
export function bandDoors({
  hat,
  quest,
  playedBefore,
  mayMakeSpace,
}: {
  hat: HomeHat | undefined;
  quest: boolean;
  playedBefore: boolean | undefined;
  mayMakeSpace: boolean;
}): BandDoor[] {
  if (hat !== 'learner' || !quest || playedBefore !== false) return [];
  return mayMakeSpace ? ['play', 'code', 'start'] : ['play', 'code'];
}

/**
 * The quick actions shown, less the twins of what is already on the home (JF23): New Quest while the Quest board (with
 * its own New Quest) is on it, and "Have a code?" while the band's doors offer Join with a code.
 */
export function shownQuickActions(
  actions: readonly QuickAction[],
  { board, doors }: { board: boolean; doors: readonly BandDoor[] },
): QuickAction[] {
  return actions.filter(
    (action) => !(action === 'new_quest' && board) && !(action === 'join_code' && doors.includes('code')),
  );
}

/** The office section's one line when nothing needs it (never "0 invitations not yet accepted"). */
export const OFFICE_NOTHING_LINE = 'Nothing needs you right now.';

/** What the office section lists: each count above zero, and whether nothing at all needs it. */
export function officeNeeds(
  office: NonNullable<MemberHome['office']>,
  tutoring: boolean,
): { toRecord: boolean; invitations: boolean; requests: boolean; assessments: boolean; nothing: boolean } {
  const toRecord = tutoring && office.to_record_count > 0;
  const invitations = office.invitations > 0;
  const requests = office.join_requests > 0;
  const assessments = (office.assessments_open ?? 0) > 0;
  return { toRecord, invitations, requests, assessments, nothing: !toRecord && !invitations && !requests && !assessments };
}

/** "2 assessments not yet reviewed". */
export function openAssessmentsLine(count: number): string {
  return `${plural(count, 'assessment')} not yet reviewed`;
}

/** "2 assessments and 3 answers to review". */
export function reviewsLine(assessments: number, quest: number): string {
  const parts = [
    assessments ? plural(assessments, 'assessment') : null,
    quest ? plural(quest, 'answer') : null,
  ].filter(Boolean);
  return `${parts.join(' and ')} to review`;
}

/** The headline of a lesson about to start or under way: "Sofia's lesson starts in 10 min." */
export function lessonNowLine(lesson: Pick<TutorHomeLesson, 'student_name'>, startsIn: number): string {
  const who = firstOf(lesson.student_name);
  return startsIn <= 0 ? `${who}'s lesson is under way.` : `${who}'s lesson starts ${startsInWords(startsIn)}.`;
}

/**
 * What the device gathers from its own reads, and the codes Join needs (the contract carries the game's id
 * only). Phase 73 (JF13): the open game and "again" come from the server's open-game read (`open`), never
 * from the device: an open game is `open_game`, titled by its label; with none, the last game's settings are
 * `continue_quest` ("Play Grade 7 Quick 5 again"), keyed by that label.
 */
export function deviceExtras({
  waiting,
  open = null,
  daily,
  questionQuest = null,
  welcomeBack = false,
  practiceLevelId = null,
  playedToday = false,
  running = null,
}: {
  waiting: readonly Pick<WaitingGame, 'game_id' | 'code' | 'host_first_name'>[];
  /** GET /quest/games/open, where Quest is on for a learner; null elsewhere or before it has loaded. */
  open?: OpenGameResponse | null;
  daily: { level_id: string; done: boolean } | null;
  /** Phase 67: a student's Question Quest with a question waiting (it replaces the landing redirect). */
  questionQuest?: { level_id: string | null } | null;
  /** Phase 67 (H8): back after a week away, from the habit summary. */
  welcomeBack?: boolean;
  /** Phase 68 (H10): where a learner's practice before a lesson starts (the board's lead), and whether they played today. */
  practiceLevelId?: string | null;
  playedToday?: boolean;
  /**
   * Phase 75 (JF30): the reader's own lesson running now (`GET /sessions/active`'s `mine`, read where Tutoring is on);
   * it leads Next up, with Stop.
   */
  running?: Pick<ActiveSession, 'student_name' | 'started_at' | 'mode'> | null;
}): { extras: NextUpExtras; codes: Record<string, string> } {
  const game = waiting[0];
  const codes: Record<string, string> = {};
  for (const row of waiting) codes[row.game_id] = row.code;
  return {
    extras: {
      game_invite: game ? { game_id: game.game_id, title: 'game', host_first_name: game.host_first_name } : null,
      open_game: open?.open ? { game_id: open.open.game_id, title: open.open.label } : null,
      continue_quest: !open?.open && open?.again ? { code: open.again.label, title: open.again.label } : null,
      daily,
      question_quest: questionQuest,
      welcome_back: welcomeBack,
      practice_level_id: practiceLevelId,
      played_today: playedToday,
      running: running ? { student_name: running.student_name, started_at: running.started_at, mode: running.mode } : null,
    },
    codes,
  };
}

/**
 * Phase 67: whether a student's Question Quest has a question waiting -- the old sign-in landing's test
 * (`state.question`), now a Next up item rather than a redirect.
 */
export function questionQuestExtra(
  state: Pick<QuestState, 'level_id' | 'question'> | null | undefined,
): { level_id: string | null } | null {
  return state?.question ? { level_id: state.level_id } : null;
}

/** Whether Next up shows the learner's next lesson already (then "Your learning" leaves its card out). */
export function nextUpShowsLearnerLesson(item: NextUp | null): boolean {
  return item?.kind === 'learner_lesson';
}

/**
 * What the learner section ("Your learning") holds: its next lesson unless Next up shows it, the Quest
 * board, the Assessment home -- and with none of them, one muted line rather than an empty heading.
 */
export function learnerSectionParts(
  nextLesson: HomeLesson | null | undefined,
  item: NextUp | null,
  sets: { quest: boolean; assessment: boolean },
): { next: HomeLesson | null; empty: boolean } {
  const next = nextLesson && !nextUpShowsLearnerLesson(item) ? nextLesson : null;
  return { next, empty: !next && !sets.quest && !sets.assessment };
}

export const LEARNER_EMPTY_LINE = 'Nothing to practise here yet: Quest and Assessments are off in this space.';
export const CHILD_OFF_LINE = 'Lessons and quests are off in this space.';

/** A child's card in a space with Tutoring and Quest off: Assessments where it is on, else a line. */
export function childCardFallback(sets: { tutoring: boolean; quest: boolean; assessment: boolean }): 'assessments' | 'off' | null {
  if (sets.tutoring || sets.quest) return null;
  return sets.assessment ? 'assessments' : 'off';
}

/** Whether Next up shows the tutor's next lesson already (then the section leaves its Now card out). */
export function nextUpShowsLesson(item: NextUp | null, lesson: Pick<TutorHomeLesson, 'schedule_id' | 'occurs_on'> | null): boolean {
  if (!item || !lesson) return false;
  if (item.kind !== 'lesson_now' && item.kind !== 'lesson_next') return false;
  return item.lesson.schedule_id === lesson.schedule_id && item.lesson.occurs_on === lesson.occurs_on;
}

/** The quick actions' words, icons and where they go. */
export const QUICK_ACTION_META: Record<QuickAction, { label: string; icon: string; href: string }> = {
  // Phase 75 (JF30): the lessons still owed, each recorded as planned, and "Another lesson" for the rest.
  record_lesson: { label: 'Record a lesson', icon: 'plus', href: '/lessons-owed' },
  start_lesson: { label: 'Start a lesson', icon: 'play', href: '/start-lesson' },
  // Phase 73 (JF36): from Home, so the game it makes exits back here.
  new_quest: { label: 'New Quest', icon: 'trophy-outline', href: '/quest/new-game?from=home' },
  // "Have a code?": the one code sheet (UI audit JF4), for a game's code or a space's.
  join_code: { label: 'Have a code?', icon: 'ticket-confirmation-outline', href: '/have-a-code' },
  start_assessment: { label: 'Start an assessment', icon: 'draw-pen', href: '/assessments' },
  // Phase 76 (JF21): the one Add chooser (a family, a tutor, someone else, an invitation).
  add_person: { label: 'Add someone', icon: 'account-plus-outline', href: '/add' },
  schedule: { label: 'Schedule', icon: 'calendar-month-outline', href: '/schedule' },
  progress: { label: 'Progress', icon: 'chart-timeline-variant', href: '/progress' },
};

// --- Phase 68 (H4, H10): focus and families ---------------------------------------------------------

/** "Make this my home": Automatic first, then each focus this person has here. Shown only with 2+ options. */
export function pinChoices(home: Pick<MemberHome, 'focus_options'>): (HomeFocus | null)[] {
  const options = home.focus_options ?? [];
  return options.length > 1 ? [null, ...options] : [];
}

/** A chip's words: "Automatic (Quest)" while nothing is pinned, "Automatic" once something is; else the focus's label. */
export function pinLabel(focus: HomeFocus | null, home: Pick<MemberHome, 'focus' | 'pin'>): string {
  if (focus) return HOME_FOCUS_LABELS[focus];
  return home.pin ? 'Automatic' : `Automatic (${HOME_FOCUS_LABELS[home.focus ?? 'quest']})`;
}

/** "Played 2 days this week (aim: 3) · today's Daily done" -- counts only (R29); null where Quest is off. */
export function childPlayedLine(child: Pick<HomeChild, 'days_played_this_week' | 'daily_done_today'>): string | null {
  if (child.days_played_this_week == null) return null;
  const daily = child.daily_done_today ? " · today's Daily done" : '';
  return `Played ${plural(child.days_played_this_week, 'day')} this week (aim: ${STREAK_DAYS_PER_WEEK})${daily}`;
}

/** "Play with Sanjay", or "Practise together before Thursday's lesson" when his lesson is close. */
export function childPlayLabel(child: Pick<HomeChild, 'first_name' | 'next_lesson'>, today: string): string {
  return practiseBefore(child.next_lesson, today)
    ? `Practise together before ${lessonDayWords(child.next_lesson!.occurs_on, today)}`
    : `Play with ${child.first_name}`;
}
