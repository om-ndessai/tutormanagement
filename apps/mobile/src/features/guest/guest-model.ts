// Ported from the pure parts of apps/web/src/features/guest/{guest-quest,guest-assessment,nudge-sheet,
// guest-home}.tsx @ 0e3ec7a (working tree). Phase 63 (P10-P12, docs/stickiness-plan.md): a guest's
// quest and Assessment, played and marked on the device from the level's guest pool. Pure, so the
// rules -- the series, the clock that pauses for the offer, when the offer shows, the marking -- are
// tested in Jest and the screens only draw them.
import {
  GUEST_DEFAULT_GRADE,
  GUEST_TODAY_SIZE,
  checkAnswer,
  guestBoard,
  guestGradeOf,
  guestLevelWords,
  guestSeries,
  guestTileName,
  guestTodayCode,
  guestTodaySet,
  type GuestGrade,
  type GuestConfig,
  type GuestQuestion,
  type GuestTile,
  type QuestionBankLevelId,
} from '@tmi/shared';

/** One answered (or skipped: `answer` null) question of a guest's quest. */
export interface GuestAnswer {
  id: string;
  answer: string | null;
  correct: boolean;
}

/** A quest in progress: kept in memory for this run, so a sign-up over it comes back to it. */
export interface GuestQuestState {
  code: string;
  questionIds: string[];
  answers: GuestAnswer[];
  startedAt: number;
  /** Time spent paused (the offer, a sign-up over the quest), left out of the clock. */
  pausedMs: number;
  /** When the current pause began; null while the clock runs. */
  pausedAt: number | null;
  /** The offer has shown in this quest: once a quest. */
  nudged: boolean;
  /** The results are recorded (seen questions, best score, counts): once. */
  finished?: boolean;
  /** Recorded with the results: every question of the level's pool has now been seen on this phone. */
  usedUp?: boolean;
}

/** Today's 5 from its level's pool: the day's five (`guestTodaySet`), the same for every visitor. */
export function startTodayQuest(
  tile: Pick<GuestTile, 'code'>,
  pool: readonly GuestQuestion[],
  day: string,
  level: string,
  now: number,
): GuestQuestState {
  const ids = guestTodaySet(pool, day, level).map((q) => q.id);
  return { code: tile.code, questionIds: ids, answers: [], startedAt: now, pausedMs: 0, pausedAt: null, nudged: false };
}

/** Today's 5 as a tile the quest screen plays: five questions, untimed, counted as "G4D5". */
export function todayTile(level: QuestionBankLevelId): GuestTile {
  return {
    code: guestTodayCode(level),
    kind: 'quest',
    level_id: level,
    mode: 'count',
    value: GUEST_TODAY_SIZE,
    words: `${guestLevelWords(level)} · Today’s 5`,
    locked: false,
  };
}

/** What a guest reads for a quest (its header, results, Challenge a friend): never its code. */
export function guestQuestName(tile: GuestTile, today = false): string {
  return today ? `Today’s 5, ${guestLevelWords(tile.level_id)}` : guestTileName(tile);
}

/** A tile's quest from its level's pool: the series unseen first (`guestSeries`), as many as it asks. */
export function startQuest(
  tile: Pick<GuestTile, 'code' | 'mode' | 'value'>,
  pool: readonly GuestQuestion[],
  seen: ReadonlySet<string>,
  now: number,
): GuestQuestState {
  const series = guestSeries(pool, seen);
  const ids = (tile.mode === 'count' ? series.slice(0, tile.value) : series).map((q) => q.id);
  return { code: tile.code, questionIds: ids, answers: [], startedAt: now, pausedMs: 0, pausedAt: null, nudged: false };
}

/** The clock as it stands, paused time left out. */
export function elapsedMs(state: GuestQuestState, now: number): number {
  const pausedNow = state.pausedAt !== null ? now - state.pausedAt : 0;
  return now - state.startedAt - state.pausedMs - pausedNow;
}

export function pauseQuest(state: GuestQuestState, now: number): GuestQuestState {
  return state.pausedAt !== null ? state : { ...state, pausedAt: now };
}

export function resumeQuest(state: GuestQuestState, now: number): GuestQuestState {
  return state.pausedAt === null ? state : { ...state, pausedMs: state.pausedMs + (now - state.pausedAt), pausedAt: null };
}

/** A timed tile's limit in ms; null for a count of questions. */
export function limitMsOf(tile: Pick<GuestTile, 'mode' | 'value'>): number | null {
  return tile.mode === 'timed' ? tile.value * 60_000 : null;
}

/** What is left on a timed tile's clock (never below zero); null for a count of questions. */
export function timeLeftMs(tile: Pick<GuestTile, 'mode' | 'value'>, state: GuestQuestState, now: number): number | null {
  const limit = limitMsOf(tile);
  return limit === null ? null : Math.max(0, limit - elapsedMs(state, now));
}

/** Over: every question answered, or the clock run out. */
export function questDone(tile: Pick<GuestTile, 'mode' | 'value'>, state: GuestQuestState, now: number): boolean {
  return state.answers.length >= state.questionIds.length || timeLeftMs(tile, state, now) === 0;
}

/** "4:05": a timed quest's clock. */
export function clockText(ms: number): string {
  return `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1000)).padStart(2, '0')}`;
}

/** Marked on the device with the shared rule (with the stem, a trailing % counts where it asks a percent); a skip is never right. */
export function markGuestAnswer(question: Pick<GuestQuestion, 'kind' | 'answer'> & { stem?: string }, given: string | null): boolean {
  return given !== null && checkAnswer({ kind: question.kind, answer: question.answer, stem: question.stem }, given);
}

/**
 * Whether the sign-up offer shows after this answer (P12): at the console's question (`nudge_after`,
 * 0 turns it off), once a quest, not on the last answer (the results are the offer then), and not
 * again within the cooldown after a dismissal on this device.
 */
export function nudgeDue({
  after,
  cooldownHours,
  dismissedAt,
  answered,
  total,
  nudged,
  now,
}: {
  after: number;
  cooldownHours: number;
  dismissedAt: number | undefined;
  answered: number;
  total: number;
  nudged: boolean;
  now: number;
}): boolean {
  const cooled = dismissedAt === undefined || dismissedAt + cooldownHours * 3_600_000 < now;
  return after > 0 && answered === after && !nudged && cooled && answered < total;
}

/**
 * One answer: marked, added, and -- when the offer is due -- the clock paused for it. `nudge` says
 * whether the offer shows and how its headline goes (right or wrong).
 */
export function answerQuest(
  state: GuestQuestState,
  question: Pick<GuestQuestion, 'id' | 'kind' | 'answer'>,
  given: string | null,
  settings: Pick<GuestConfig['settings'], 'nudge_after' | 'nudge_cooldown_hours'>,
  dismissedAt: number | undefined,
  now: number,
): { state: GuestQuestState; correct: boolean; nudge: boolean } {
  const correct = markGuestAnswer(question, given);
  const answers = [...state.answers, { id: question.id, answer: given, correct }];
  const nudge = nudgeDue({
    after: settings.nudge_after,
    cooldownHours: settings.nudge_cooldown_hours,
    dismissedAt,
    answered: answers.length,
    total: state.questionIds.length,
    nudged: state.nudged,
    now,
  });
  const next = { ...state, answers };
  return { state: nudge ? { ...next, nudged: true, pausedAt: now } : next, correct, nudge };
}

export function guestScore(answers: readonly Pick<GuestAnswer, 'correct'>[]): number {
  return answers.filter((a) => a.correct).length;
}

/** "1,200+" -- a level's member count, rounded down, never more than is true; null below 20. */
export function roundedCount(n: number): string | null {
  if (n < 20) return null;
  const step = n >= 1000 ? 100 : n >= 100 ? 50 : 10;
  return `${(Math.floor(n / step) * step).toLocaleString('en-US')}+`;
}

/** What a free account adds, the level's own line first (P12). */
export function benefitsFor(levelId: QuestionBankLevelId | undefined, memberCounts: Record<string, number>): string[] {
  const count = levelId ? roundedCount(memberCounts[levelId] ?? 0) : null;
  return [
    count && levelId ? `${count} more ${guestLevelWords(levelId)} questions, never repeated` : 'Many more questions, never repeated',
    'Every quest unlocked: longer, timed, and family games',
    'Family games: one tap, no codes',
    'Your scores saved',
  ];
}

/** The Assessment's offer: what keeping it adds, then the level's two lines. */
export function assessmentBenefits(levelId: QuestionBankLevelId, memberCounts: Record<string, number>): string[] {
  return ['A PDF of your work, kept for you', 'A tutor can review it and write back', ...benefitsFor(levelId, memberCounts).slice(0, 2)];
}

/** "You've played all the free Grade 4 questions. …" -- the out-of-questions offer on the results. */
export function usedUpText(tile: Pick<GuestTile, 'level_id'>, benefits: readonly string[]): string {
  return `You’ve played all the free ${guestLevelWords(tile.level_id)} questions. ${benefits[0]} with a free account.`;
}

/** A link to the web's Play home, or to one tile: what "Ask a grown-up" and "Challenge a friend" share. */
export function playLink(origin: string | null | undefined, code?: string): string {
  const base = (origin ?? '').replace(/\/+$/, '');
  return `${base}/${code ? `play/${code}` : ''}`;
}

/** Challenge a friend (P14): the score and the quest's name (never its code), naming nobody. */
export function challengeText(score: number, total: number, name: string): string {
  return `I got ${score}/${total} on ${name} on Aimtrue. Can you beat it?`;
}

/** Ask a grown-up (P12): it collects nothing, and names nobody. */
export const ASK_ADULT_TEXT = 'I have been playing math quests on Aimtrue. Can you set me up with an account?';

/** The grade the board opens on: the one remembered on this device (as a level), else Grade 4. */
export function boardGrade(remembered: QuestionBankLevelId | undefined): GuestGrade {
  return guestGradeOf(remembered) ?? GUEST_DEFAULT_GRADE;
}

/**
 * The level a grade is remembered as on this device: the grade's own level among the tiles (so the
 * member's Play home can lead with it, `guestLeadLevel`), else its advanced one, else Grade N's NC level.
 */
export function gradeLevel(tiles: readonly GuestTile[], grade: GuestGrade): QuestionBankLevelId {
  const { standard, advanced } = guestBoard(tiles, grade);
  return standard[0]?.level_id ?? advanced[0]?.level_id ?? (`NC26.${grade}` as QuestionBankLevelId);
}

/** How many questions a guest Assessment draws: the tile's number, capped by the console's. */
export function assessmentCount(tile: Pick<GuestTile, 'value'>, settings: Pick<GuestConfig['settings'], 'assessment_questions'>): number {
  return Math.min(tile.value, settings.assessment_questions || tile.value);
}

/** One page of a guest Assessment as marked: the given answer (a choice's text, or the typed number). */
export interface AssessmentMark {
  question: GuestQuestion;
  given: string | null;
  right: boolean;
}

/**
 * Marks a guest Assessment on the device (P11): a choice question by the chosen choice's text, a
 * number question by the typed final number (blank: unanswered), each with `checkAnswer`.
 */
export function markAssessment(
  questions: readonly GuestQuestion[],
  choices: Record<string, number | null | undefined>,
  numbers: Record<string, string | undefined>,
): AssessmentMark[] {
  return questions.map((question) => {
    let given: string | null = null;
    if (question.kind === 'choice') {
      const index = choices[question.id];
      given = index !== null && index !== undefined ? (question.choices[index] ?? null) : null;
    } else {
      const typed = numbers[question.id]?.trim();
      given = typed ? typed : null;
    }
    return { question, given, right: markGuestAnswer(question, given) };
  });
}
