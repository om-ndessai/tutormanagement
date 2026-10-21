// Question Quest's pure rules (Phase 42), from apps/web/src/features/quest/{api.ts, quest-page.tsx,
// quest-play-page.tsx, quest-review-page.tsx} @ 82397b8 (working tree): who plays and who reviews,
// the once-per-session landing, the sentences and labels the screens show (the web's copy), the
// level picker's options, and the answer a submit sends. Pure: no React, no api client.
import {
  QUESTION_BANK_LEVEL_IDS,
  QUEST_POINTS,
  levelLabel,
  questLevelLabel,
  type QuestReviewDecision,
  type QuestReviewQueue,
  type QuestState,
} from '@tmi/shared';

/** Who Quest is for, in this organization: a student plays; a tutor or an admin reviews. */
export function questRoles(roles: readonly string[] | undefined) {
  const list = roles ?? [];
  return {
    plays: list.includes('student'),
    reviews: list.includes('tutor') || list.includes('admin'),
  };
}

// --- The landing ------------------------------------------------------------------------------

/**
 * Who the sign-in landing is for (the web's QuestLanding): a student who neither tutors nor runs
 * the organization, and a tutor who is neither an admin nor a student. Anyone else (an admin, a
 * parent, someone holding both sides) is never taken anywhere.
 */
export type QuestLandingKind = 'student' | 'tutor';

export function questLandingKind(roles: readonly string[] | undefined): QuestLandingKind | null {
  const { plays, reviews } = questRoles(roles);
  const admin = Boolean(roles?.includes('admin'));
  if (plays && !reviews) return 'student';
  if (!plays && reviews && !admin) return 'tutor';
  return null;
}

export type QuestLandingHref = '/quest/play' | '/quest/review';

/** Not decided yet (waiting for the server), or decided: go somewhere, or nowhere. */
export type QuestLandingDecision = { settled: false } | { settled: true; href: QuestLandingHref | null };

/**
 * Where Home sends the reader, once: a student with a question waiting goes to play, a tutor with
 * answers waiting goes to review. Nothing is decided while the organization has Quest off (it may
 * be switched on later in the session, as on the web), and the welcome wizard, when it is about to
 * open, comes first: no landing in that session.
 */
export function decideQuestLanding({
  on,
  kind,
  wizardPending,
  state,
  queue,
}: {
  on: boolean;
  kind: QuestLandingKind | null;
  wizardPending: boolean;
  state: QuestState | undefined;
  queue: QuestReviewQueue | undefined;
}): QuestLandingDecision {
  if (!on) return { settled: false };
  if (!kind || wizardPending) return { settled: true, href: null };
  if (kind === 'student') {
    if (!state) return { settled: false };
    return { settled: true, href: state.question ? '/quest/play' : null };
  }
  if (!queue) return { settled: false };
  return { settled: true, href: queue.waiting > 0 ? '/quest/review' : null };
}

/** One landing per person per organization, for as long as they stay signed in. */
export function landingKey(userId: string, organizationSlug: string): string {
  return `${userId}|${organizationSlug}`;
}

// In memory only (never persisted): a new sign-in, or a new launch, lands again.
const landed = new Set<string>();

export function hasLanded(key: string): boolean {
  return landed.has(key);
}

export function markLanded(key: string): void {
  landed.add(key);
}

/** On signing out: the next person (or the same one, signing in again) lands afresh. */
export function forgetQuestLandings(): void {
  landed.clear();
}

// --- Words ------------------------------------------------------------------------------------

/** "1 point", "12 points". */
export function pointsLabel(points: number): string {
  return `${points} ${points === 1 ? 'point' : 'points'}`;
}

/** The toast after an answer: the points for trying, never right or wrong. */
export function savedToast(points: number = QUEST_POINTS.student_attempt): string {
  return `Saved. +${points} point${points === 1 ? '' : 's'}`;
}

export function reviewToast(decision: QuestReviewDecision): string {
  return decision === 'approve' ? 'Approved. The question is in the bank.' : 'Flagged for the platform.';
}

/** The hub's student line: "BA3 · 4 answered". The points follow it, with their trophy. */
export function playSummary(state: Pick<QuestState, 'level_id' | 'answered'> | undefined): string {
  return `${questLevelLabel(state?.level_id ?? null)} · ${state?.answered ?? 0} answered`;
}

export function startLabel(answered: number | undefined): string {
  return answered ? 'Carry on' : 'Start';
}

export function movedUpText(from: string, to: string | null): string {
  return `You finished ${questLevelLabel(from)}. On to ${questLevelLabel(to)}!`;
}

export function finishedText(answered: number): string {
  return `You have answered every question there is to answer for now. ${answered} answered in all.`;
}

export const NO_LEVEL_TEXT =
  'Your tutor has not chosen your starting level yet. Ask them to set it, then come back.';

export function firstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}

/** "The blind solver answered 12 and noted: …", or null when it said nothing. */
export function solverLine(answer: string | null, issues: string | null): string | null {
  if (!answer && !issues) return null;
  return `The blind solver answered ${answer ?? '—'}${issues ? ` and noted: ${issues}` : '.'}`;
}

// --- The level picker -------------------------------------------------------------------------

/** The picker's "no level" option: the web's Select uses the same value. */
export const NOT_SET = 'none';

export interface LevelOption {
  id: string;
  label: string;
}

/** "Not set", then every level of the bank, in the bank's order. */
export function levelOptions(): LevelOption[] {
  return [
    { id: NOT_SET, label: 'Not set' },
    ...QUESTION_BANK_LEVEL_IDS.map((id) => ({ id, label: levelLabel(id) })),
  ];
}

/** The picker's value to the request's: "none" clears the level. */
export function levelInput(value: string): (typeof QUESTION_BANK_LEVEL_IDS)[number] | null {
  return value === NOT_SET ? null : (value as (typeof QUESTION_BANK_LEVEL_IDS)[number]);
}

export function levelToast(fullName: string, value: string): string {
  return value === NOT_SET
    ? `${fullName}’s level is cleared.`
    : `${fullName} starts at ${levelLabel(value)}.`;
}

// --- Answering --------------------------------------------------------------------------------

/** What Submit sends: the chosen option's text, or the number as typed (trimmed); '' for nothing. */
export function questResponse(
  question: { kind: string; choices: string[] },
  choice: number | null,
  typed: string,
): string {
  if (question.kind === 'choice') return choice === null ? '' : (question.choices[choice] ?? '');
  return typed.trim();
}

/** Wide enough for the question beside the answer: an iPad, either way up. */
export const QUEST_WIDE_FROM = 700;

export function questWide(width: number): boolean {
  return width >= QUEST_WIDE_FROM;
}
