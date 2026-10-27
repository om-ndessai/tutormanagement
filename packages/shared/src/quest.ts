import { z } from 'zod';
import { levelLabel } from './canvas-assessments.js';
import { QUESTION_BANK_LEVEL_IDS, type QuestionDifficulty, type QuestionKind } from './questions.js';
import { refuseSsn } from './tax.js';

// ---------------------------------------------------------------------------
// Gamification: Question Quest (Phase 42, docs/gamification-plan.md)
// ---------------------------------------------------------------------------
// While an organization's `gamify_question_quest` is on, a signed-in student
// answers the bank's checked (unapproved) questions one at a time, from their
// level, with no going back; code marks each answer. A tutor of theirs reviews
// it and either approves the question -- for the whole platform -- or flags it.
// A student earns points separately for the attempt and for correctness; a
// tutor earns a point for each review, whatever its outcome (owner,
// 2026-10-20). Kept in an append-only ledger.

/**
 * The order a student's level moves up in once its questions are used up:
 * NC 2026's grades from Kindergarten to Math 2, NC 2017's from Kindergarten
 * to Math 3, Beast Academy's levels into the AoPS books, and Math Kangaroo's
 * levels by grade (docs/question-bank-kangaroo.md). A level never
 * moves from one family into another, and the fourth-year courses (NC 2026's
 * three, NC 2017's Math 4 and Precalculus), which no course follows, move nowhere.
 */
export const QUEST_LEVEL_FAMILIES: readonly (readonly (typeof QUESTION_BANK_LEVEL_IDS)[number][])[] = [
  ['NC26.K', 'NC26.1', 'NC26.2', 'NC26.3', 'NC26.4', 'NC26.5', 'NC26.6', 'NC26.7', 'NC26.8', 'NC26.M1', 'NC26.M2'],
  ['NC17.K', 'NC17.1', 'NC17.2', 'NC17.3', 'NC17.4', 'NC17.5', 'NC17.6', 'NC17.7', 'NC17.8', 'NC17.M1', 'NC17.M2', 'NC17.M3'],
  ['BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO'],
  ['MK12', 'MK34', 'MK56'],
];

/** The level after this one in its family, or null at the end of it. */
export function nextQuestLevel(levelId: string): string | null {
  for (const family of QUEST_LEVEL_FAMILIES) {
    const index = family.indexOf(levelId as (typeof family)[number]);
    if (index >= 0) return family[index + 1] ?? null;
  }
  return null;
}

/**
 * What each award is worth: one table, so the values can be tuned without a
 * schema change (the ledger stores the points given at the time).
 * - student_attempt: a student answered a question.
 * - student_correct: their answer was right and a tutor approved the question.
 * - tutor_review: a tutor reviewed an answer, approved or flagged alike -- the
 *   only way a tutor earns, so approving never pays more than an honest flag.
 */
export const QUEST_POINTS = {
  student_attempt: 1,
  student_correct: 1,
  tutor_review: 1,
} as const;
export type PointsReason = keyof typeof QUEST_POINTS;

/**
 * How many DIFFERENT people must answer a checked question correctly in Question Quest for it to
 * be approved for every organization by itself (owner, 2026-10-24: the bank had grown past what
 * tutors could review one by one). A question also waits with up to this many students of one
 * organization at once, so the second answer can arrive before anyone reviews the first. A tutor's
 * review still approves or flags it, and a flag outranks an approval made this way.
 */
export const QUEST_CONSENSUS_CORRECT = 2;
export const POINTS_REASONS = Object.keys(QUEST_POINTS) as PointsReason[];

export const POINTS_REASON_LABELS: Record<PointsReason, string> = {
  student_attempt: 'Answered a question',
  student_correct: 'Answer confirmed correct',
  tutor_review: 'Reviewed an answer',
};

export const QUEST_REVIEW_DECISIONS = ['approve', 'flag'] as const;
export type QuestReviewDecision = (typeof QUEST_REVIEW_DECISIONS)[number];

/** A student's answer. Choices are answered with the option's text; numbers as typed. */
export const questAnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer: refuseSsn(z.string().trim().min(1, 'Give an answer.').max(120, 'That answer is too long.')),
});
export type QuestAnswerInput = z.infer<typeof questAnswerSchema>;

/** A tutor's review. A flag must say what is wrong with the question. */
export const questReviewSchema = z
  .object({
    decision: z.enum(QUEST_REVIEW_DECISIONS),
    note: refuseSsn(z.string().trim().max(400, 'Keep it under 400 characters.')).optional(),
  })
  .refine((value) => value.decision !== 'flag' || (value.note ?? '').length > 0, {
    message: 'Say what is wrong with the question.',
    path: ['note'],
  });
export type QuestReviewInput = z.infer<typeof questReviewSchema>;

/** Where a student starts, or null to clear it. */
export const questLevelSchema = z.object({
  level_id: z.enum(QUESTION_BANK_LEVEL_IDS, { message: 'Choose a level.' }).nullable(),
});
export type QuestLevelInput = z.infer<typeof questLevelSchema>;

/** The question a student is shown: never its key, solution or checks. */
export interface QuestQuestion {
  id: string;
  kind: QuestionKind;
  stem: string;
  choices: string[];
  level_id: string;
}

export interface QuestState {
  /** Their level now, or null until an adult sets one. */
  level_id: string | null;
  question: QuestQuestion | null;
  /** Set when this request moved them up because their last level was used up. */
  moved_up_from: string | null;
  /** True when every level left in their family is used up. */
  finished: boolean;
  points: number;
  answered: number;
}

/** One answer waiting for (or given) a tutor's review, with what the tutor needs to judge it. */
export interface QuestReviewItem {
  attempt_id: string;
  student_user_id: string;
  student_name: string;
  submitted_at: string;
  answer: string;
  /** Marked by code against the bank's key. */
  correct: boolean;
  question: {
    id: string;
    kind: QuestionKind;
    difficulty: QuestionDifficulty;
    level_id: string;
    topic_code: string;
    topic_name: string;
    skill: string | null;
    stem: string;
    choices: string[];
    answer: string;
    solution: string;
    /** What the blind solver answered and said, if anything. */
    solver_answer: string | null;
    solver_issues: string | null;
  };
}

export interface QuestReviewQueue {
  item: QuestReviewItem | null;
  /** Answers waiting, this one included. */
  waiting: number;
  points: number;
}

/** A student as a tutor or admin manages their Quest. */
export interface QuestStudent {
  user_id: string;
  full_name: string;
  level_id: string | null;
  answered: number;
  confirmed: number;
  waiting: number;
  points: number;
  last_active: string | null;
}

/** "BA3", "G5": a level as Quest shows it. */
export function questLevelLabel(levelId: string | null): string {
  return levelId ? levelLabel(levelId) : 'No level yet';
}

// ---------------------------------------------------------------------------
// The welcome (owner, 2026-10-21): a personal popup when a student opens
// Quest, with confetti, a few numbers and one line to bring them back.
// ---------------------------------------------------------------------------

export interface QuestSummary {
  first_name: string;
  level_id: string | null;
  points: number;
  answered: number;
  /** Answers a tutor approved as correct. */
  confirmed: number;
  answered_today: number;
  /** Days in a row with an answer, ending today or yesterday (on the organization's clock). */
  streak_days: number;
  /** True when the streak counts yesterday but not yet today: one answer today keeps it. */
  streak_at_risk: boolean;
  best_streak: number;
  /** Unanswered questions left in their level, capped at QUEST_LEFT_CAP. */
  left_in_level: number;
}

/** The count of what is left in a level stops here: "200+" is enough to say. */
export const QUEST_LEFT_CAP = 200;

/** How long the welcome stays up before it closes itself. */
export const QUEST_WELCOME_MS = 5000;

/**
 * Streaks from the days a student answered (YYYY-MM-DD, any order): the
 * current run ending today or yesterday, whether it still needs today, and
 * the longest run.
 */
export function questStreak(days: readonly string[], today: string): { current: number; atRisk: boolean; best: number } {
  const set = new Set(days);
  const back = (date: string, n: number) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! - n)).toISOString().slice(0, 10);
  };
  const end = set.has(today) ? today : set.has(back(today, 1)) ? back(today, 1) : null;
  let current = 0;
  if (end) while (set.has(back(end, current))) current += 1;
  let best = 0;
  for (const day of set) {
    if (set.has(back(day, 1))) continue;
    let run = 0;
    const [y, m, d] = day.split('-').map(Number);
    while (set.has(new Date(Date.UTC(y!, m! - 1, d! + run)).toISOString().slice(0, 10))) run += 1;
    best = Math.max(best, run);
  }
  return { current, atRisk: current > 0 && end !== today, best };
}

/** The welcome's headline and its one line to bring them back -- the same words on the web and the app. */
export function questWelcome(summary: QuestSummary, levelLabelText: string): { title: string; line: string } {
  const name = summary.first_name;
  if (summary.answered === 0) {
    return {
      title: `Welcome to Question Quest, ${name}!`,
      line: `Every answer earns a point, and another when your tutor approves a right one. Let's start ${levelLabelText}.`,
    };
  }
  const title = summary.streak_days > 1 ? `${summary.streak_days} days in a row, ${name}!` : `Welcome back, ${name}!`;
  let line: string;
  if (summary.streak_at_risk) line = `Answer one today to keep your ${summary.streak_days}-day streak going.`;
  else if (summary.streak_days >= 1 && summary.answered_today > 0)
    line = `You're on a roll today: ${summary.answered_today} answered. Come back tomorrow to make it ${summary.streak_days + 1} days.`;
  else if (summary.left_in_level > 0 && summary.left_in_level <= 20)
    line = `Only ${summary.left_in_level} questions left in ${levelLabelText}. Finish it and move up!`;
  else if (summary.best_streak > 1) line = `Your best streak is ${summary.best_streak} days. Start a new one today!`;
  else line = 'Answer a few today, then come back tomorrow to start a streak.';
  return { title, line };
}
