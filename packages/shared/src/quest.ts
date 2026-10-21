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
 * NC 2026's grades, then Beast Academy's levels into the AoPS books. A level
 * never moves from one family into the other.
 */
export const QUEST_LEVEL_FAMILIES: readonly (readonly (typeof QUESTION_BANK_LEVEL_IDS)[number][])[] = [
  ['NC26.3', 'NC26.4', 'NC26.5', 'NC26.6', 'NC26.7', 'NC26.8', 'NC26.M1'],
  ['BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO'],
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
