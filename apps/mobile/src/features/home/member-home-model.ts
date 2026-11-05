// The member home's words and choices (Phase 66, docs/member-home-plan.md H1-H4), pure so they are
// tested without a device. The rules themselves (which hats, their order, Next up, the quick actions) are
// the shared contract's (`packages/shared/src/home.ts`); this file only words them for the phone and
// gathers what only the device knows. Nothing here carries money.
import {
  HOME_FOCUS_LABELS,
  STREAK_DAYS_PER_WEEK,
  lessonDayWords,
  lessonWhen,
  practiseBefore,
  startsInWords,
  type HomeChild,
  type HomeFocus,
  type HomeHat,
  type HomeLesson,
  type MemberHome,
  type NextUp,
  type NextUpExtras,
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

/** "Thu at 5:00 PM with Priya". */
export function lessonWithTutor(lesson: Pick<HomeLesson, 'occurs_on' | 'start_time' | 'tutor_name'>, today: string): string {
  return `${whenWords(lesson, today)} with ${firstOf(lesson.tutor_name)}`;
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

/** "3 to record · 2 invitations · 1 asking to join", only the non-zero parts; else "All caught up". */
export function officeStrip(office: NonNullable<MemberHome['office']>): string {
  const parts: string[] = [];
  if (office.to_record_count > 0) parts.push(`${office.to_record_count} to record`);
  if (office.invitations > 0) parts.push(plural(office.invitations, 'invitation'));
  if (office.join_requests > 0) parts.push(`${office.join_requests} asking to join`);
  return parts.length > 0 ? parts.join(' · ') : 'All caught up';
}

/** "Sofia: next Tue at 4:00 PM" / "Sofia: no lessons scheduled". */
export function childStrip(child: HomeChild, today: string): string {
  return child.next_lesson
    ? `${child.first_name}: next ${whenWords(child.next_lesson, today)}`
    : `${child.first_name}: no lessons scheduled`;
}

/** The learner's line: their next lesson, else the streak (where Quest is on), else a calm word. */
export function learnerStrip(
  learner: MemberHome['learner'],
  today: string,
  streak: string | null,
): string {
  if (learner?.next_lesson) return `Next lesson: ${lessonWithTutor(learner.next_lesson, today)}`;
  return streak ?? 'Ready when you are';
}

/** The band's one line, for the first hat of `orderHats` (null without a hat). */
export function stripLine(home: MemberHome, hat: HomeHat | undefined, streak: string | null): string | null {
  switch (hat) {
    case 'tutor':
      return home.tutor ? tutorStrip(home.tutor) : null;
    case 'office':
      return home.office ? officeStrip(home.office) : null;
    case 'parent': {
      const child = home.parent?.children[0];
      return child ? childStrip(child, home.day) : 'No lessons scheduled';
    }
    case 'learner':
      return learnerStrip(home.learner, home.day, streak);
    default:
      return null;
  }
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

/** What only the device knows, and the codes Join needs (the contract carries the game's id only). */
export function deviceExtras({
  waiting,
  lastLabel,
  daily,
  questionQuest = null,
  welcomeBack = false,
  practiceLevelId = null,
  playedToday = false,
}: {
  waiting: readonly Pick<WaitingGame, 'game_id' | 'code' | 'host_first_name'>[];
  lastLabel: string | null;
  daily: { level_id: string; done: boolean } | null;
  /** Phase 67: a student's Question Quest with a question waiting (it replaces the landing redirect). */
  questionQuest?: { level_id: string | null } | null;
  /** Phase 67 (H8): back after a week away, from the habit summary. */
  welcomeBack?: boolean;
  /** Phase 68 (H10): where a learner's practice before a lesson starts (the board's lead), and whether they played today. */
  practiceLevelId?: string | null;
  playedToday?: boolean;
}): { extras: NextUpExtras; codes: Record<string, string> } {
  const game = waiting[0];
  const codes: Record<string, string> = {};
  for (const row of waiting) codes[row.game_id] = row.code;
  return {
    extras: {
      game_invite: game ? { game_id: game.game_id, title: 'game', host_first_name: game.host_first_name } : null,
      continue_quest: lastLabel ? { code: lastLabel, title: lastLabel } : null,
      daily,
      question_quest: questionQuest,
      welcome_back: welcomeBack,
      practice_level_id: practiceLevelId,
      played_today: playedToday,
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
  record_lesson: { label: 'Record a lesson', icon: 'plus', href: '/record-lesson' },
  start_lesson: { label: 'Start a lesson', icon: 'play', href: '/start-lesson' },
  new_quest: { label: 'New Quest', icon: 'trophy-outline', href: '/quest/new-game' },
  // "Have a code?": the one code sheet (UI audit JF4), for a game's code or a space's.
  join_code: { label: 'Have a code?', icon: 'ticket-confirmation-outline', href: '/have-a-code' },
  start_assessment: { label: 'Start an assessment', icon: 'draw-pen', href: '/assessments' },
  add_person: { label: 'Add someone', icon: 'account-plus-outline', href: '/person-form' },
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
