// Ported from apps/web/src/features/habit/{my-progress-card,daily-page}.tsx and the Daily button of
// apps/web/src/features/play/play-home.tsx @ 0e3ec7a (working tree): their words and decisions, kept
// pure here so Jest can hold them. Phase 64 (P17-P20, docs/stickiness-plan.md); Phase 67 (H8): the week
// strip, welcome back, the next badge and the Daily's rings.
// Phase 73 (JF16, JF23): My progress says ONE headline from the current run (the streak, "Start a streak",
// or -- back after a week away -- the welcome, never two at once and never a loss); the members' Daily is
// `DAILY_NAME` ("Today's Daily") with its level in words, and its level is shared `dailyLevelFor`'s, the one
// rule the board and Next up both use.
import {
  DAILY_NAME,
  DAILY_SET_SIZE,
  STREAK_DAYS_PER_WEEK,
  TILE_LEVEL_TAGS,
  TILE_LEVEL_WORDS,
  type DailySet,
  type HabitSummary,
  type NextBadge,
  type WeekDot,
  type QuestionBankLevelId,
} from '@tmi/shared';

// --- My progress (P17-P18) -------------------------------------------------

/** "Start a streak", or "3 weeks in a row". */
export function streakLine(weeks: number): string {
  return weeks === 0 ? 'Start a streak' : `${weeks} week${weeks === 1 ? '' : 's'} in a row`;
}

/** "2 of 3 days this week" (a week counts once it has its days; more are not shown). */
export function daysLine(days: number): string {
  return `${Math.min(days, STREAK_DAYS_PER_WEEK)} of ${STREAK_DAYS_PER_WEEK} days this week`;
}

/** What the ring says to assistive tech. */
export function todayLabel(playedToday: boolean): string {
  return playedToday ? 'Played today' : 'Not played yet today';
}

export const NO_BADGE_TEXT = 'Your first badge is one quest away.';

// --- The week, made visible and kind (Phase 67, H8) -------------------------

export const WEEK_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const DOT_WORDS: Record<WeekDot, string> = {
  played: 'played',
  missed: 'not played',
  today: 'today, not played yet',
  ahead: 'still to come',
};

/** One dot read aloud: "Monday: played". */
export function weekDotLabel(index: number, dot: WeekDot): string {
  return `${WEEK_DAY_NAMES[index] ?? ''}: ${DOT_WORDS[dot]}`;
}

/** Back after time away: a fresh start, never what was lost. */
export const WELCOME_BACK_TEXT = 'Welcome back! A fresh week starts now.';

/**
 * Phase 73 (JF16): My progress's ONE state, from the current run -- a streak and what keeps it, a welcome back,
 * or "Start a streak" -- never two that disagree, and never a zero first (the web's words, my-progress-card.tsx).
 * Badges once earned stay listed below, as badges.
 */
export function progressHeadline(
  summary: Pick<HabitSummary, 'streak_weeks' | 'days_this_week'> & Partial<Pick<HabitSummary, 'welcome_back'>>,
): { title: string; detail: string; welcome: boolean } {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const left = Math.max(0, STREAK_DAYS_PER_WEEK - summary.days_this_week);
  if (summary.streak_weeks > 0) {
    return {
      title: `${summary.streak_weeks}-week streak`,
      detail: left === 0 ? 'This week counts. Keep it going next week.' : `Play ${days(left)} more this week to keep it.`,
      welcome: false,
    };
  }
  if (summary.welcome_back) {
    return {
      title: 'Welcome back!',
      detail: `A fresh week starts now: play ${days(STREAK_DAYS_PER_WEEK)} to start a streak.`,
      welcome: true,
    };
  }
  return {
    title: 'Start a streak',
    detail:
      summary.days_this_week === 0
        ? `Play on ${days(STREAK_DAYS_PER_WEEK)} this week.`
        : `${summary.days_this_week} of ${STREAK_DAYS_PER_WEEK} days this week. ${left} to go.`,
    welcome: false,
  };
}

/** "Next badge: 10 quests · 4 of 10". */
export function nextBadgeLine(badge: Pick<NextBadge, 'label' | 'have' | 'need'>): string {
  return `Next badge: ${badge.label} · ${badge.have} of ${badge.need}`;
}

/** The badges earned, in the shared order. */
export function earnedOf(summary: Pick<HabitSummary, 'badges'>) {
  return summary.badges.filter((badge) => badge.earned);
}

// --- The Daily (P19) -------------------------------------------------------

/** A level's tag ("G4"), the Daily's being "G4D". An unknown level is shown as it is. */
export function levelTag(levelId: string): string {
  return TILE_LEVEL_TAGS[levelId as QuestionBankLevelId] ?? levelId;
}

export function levelWords(levelId: string): string {
  return TILE_LEVEL_WORDS[levelId as QuestionBankLevelId] ?? levelId;
}

/** "Today's Daily · Grade 4": the members' Daily by its one name, its level in words (JF23, JF32). */
export function dailyButtonLabel(levelId: string): string {
  return `${DAILY_NAME} · ${levelWords(levelId)}`;
}

/** The Daily's button on the board and in Next up. */
export const PLAY_DAILY_LABEL = `Play ${DAILY_NAME[0]!.toLowerCase()}${DAILY_NAME.slice(1)}`;

/** Phase 67 (H8): the Daily card's five rings -- hit or missed once played, else open. */
export function dailyRings(result: Pick<DailySet, 'result'>['result'], size: number = DAILY_SET_SIZE): ('open' | 'hit' | 'miss')[] {
  return Array.from({ length: size }, (_, i) => {
    const mark = result?.marks[i];
    return mark === undefined ? 'open' : mark ? 'hit' : 'miss';
  });
}

/** The Daily card's line: the call before playing, the hits after. */
export function dailyCardTitle(result: Pick<DailySet, 'result'>['result']): string {
  if (!result) return 'Five questions. Can you hit all five?';
  return `You hit ${result.right} of ${result.of} today.`;
}

/** What the rings say to assistive tech. */
export function dailyRingsLabel(result: Pick<DailySet, 'result'>['result'], size: number = DAILY_SET_SIZE): string {
  return result ? `${result.right} hit of ${result.of}` : `${size} targets, not played yet`;
}

/** "G4D #42 · 4 of 5". */
export function dailyHeading(levelId: string, number: number, right: number, of: number): string {
  return `${levelTag(levelId)}D #${number} · ${right} of ${of}`;
}

/** The status under the title while playing: "Grade 4 · question 2 of 5". */
export function dailyProgress(levelId: string, index: number, total: number): string {
  return `${levelWords(levelId)} · question ${index + 1} of ${total}`;
}

/** The marks as the grid: "✓✓✗✓✓". */
export function dailyGrid(marks: readonly boolean[]): string {
  return marks.map((m) => (m ? '✓' : '✗')).join('');
}

/** The grid read aloud: "4 of 5 right: 1 right, 2 right, 3 wrong…". */
export function dailyGridSpeech(marks: readonly boolean[]): string {
  const right = marks.filter(Boolean).length;
  return `${right} of ${marks.length} right: ${marks.map((m, i) => `${i + 1} ${m ? 'right' : 'wrong'}`).join(', ')}`;
}

export const DAILY_NEXT_TEXT = 'A new Daily tomorrow. Same five questions for everyone today.';

/**
 * One answer given (null is a skip). The answers so far, and whether that was the last: then they go to
 * the server in one request, which marks them.
 */
export function giveAnswer(
  answers: readonly (string | null)[],
  given: string | null,
  total: number,
): { answers: (string | null)[]; done: boolean } {
  const next = [...answers, given];
  return { answers: next, done: next.length >= total };
}

/** Seconds since the play began, whole. */
export function secondsSince(startedAt: number, now: number): number {
  return Math.max(0, Math.round((now - startedAt) / 1000));
}
