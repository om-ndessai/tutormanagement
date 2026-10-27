import { z } from 'zod';
import { containsSsn, refuseSsn } from './tax.js';

// ---------------------------------------------------------------------------
// The question bank (Phase 36)
// ---------------------------------------------------------------------------
// Platform reference data, like the catalog: maths questions, one standard
// each, written by a model, checked by code and by a second model working
// blind, and approved by a platform admin before any child sees one
// (docs/ai-platform-plan.md, "How a question earns trust").

/**
 * The levels the bank covers, in the console's order: NC 2026, grades 3-8 and Math 1 (owner,
 * 2026-10-17) and, since 2026-10-22, the rest of it -- Kindergarten to grade 2, Math 2 and the
 * three fourth-year courses -- then, since 2026-10-23, NC 2017 from Kindergarten to Precalculus
 * (docs/question-bank-nc-2017.md), then Beast Academy's Levels 1-5 and the three AoPS books its
 * catalog carries, one chapter a topic (owner, 2026-10-18), then, since 2026-10-27, Math Kangaroo's
 * levels, one kind of contest problem a topic (docs/question-bank-kangaroo.md). The Assessment menu
 * draws on all of them (CANVAS_ASSESSMENT_LEVEL_IDS).
 */
export const QUESTION_BANK_LEVEL_IDS = [
  'NC26.K',
  'NC26.1',
  'NC26.2',
  'NC26.3',
  'NC26.4',
  'NC26.5',
  'NC26.6',
  'NC26.7',
  'NC26.8',
  'NC26.M1',
  'NC26.M2',
  'NC26.ALR',
  'NC26.ASDS',
  'NC26.MSM',
  'NC17.K',
  'NC17.1',
  'NC17.2',
  'NC17.3',
  'NC17.4',
  'NC17.5',
  'NC17.6',
  'NC17.7',
  'NC17.8',
  'NC17.M1',
  'NC17.M2',
  'NC17.M3',
  'NC17.M4',
  'NC17.PC',
  'BA1',
  'BA2',
  'BA3',
  'BA4',
  'BA5',
  'PRE',
  'ALG',
  'GEO',
  'MK12',
  'MK34',
] as const;

/**
 * How a question came to be approved: 'console' (a platform admin), 'quest' (a tutor confirming a
 * student's answer, Phase 42) or 'quest_consensus' (2026-10-24: two or more different people answered
 * it correctly in Question Quest, marked by code; `QUEST_CONSENSUS_CORRECT`).
 */
export const QUESTION_APPROVED_VIA = ['console', 'quest', 'quest_consensus'] as const;
export type QuestionApprovedVia = (typeof QUESTION_APPROVED_VIA)[number];

export const QUESTION_KINDS = ['choice', 'numeric'] as const;
export type QuestionKind = (typeof QUESTION_KINDS)[number];

/**
 * `draft`: written, not yet checked. `checked`: every automatic check passed.
 * `flagged`: one failed, with the reason. `approved`: a person passed it, the
 * only status a test may draw on. `retired`: never deleted, once used.
 */
export const QUESTION_STATUSES = ['draft', 'checked', 'flagged', 'approved', 'retired'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_STATUS_LABELS: Record<QuestionStatus, string> = {
  draft: 'Not checked',
  checked: 'Checked',
  flagged: 'Flagged',
  approved: 'Approved',
  retired: 'Retired',
};

/** Within its standard: 1 easier, 2 on grade, 3 stretch. */
export const QUESTION_DIFFICULTIES = [1, 2, 3] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];
export const QUESTION_DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  1: 'Easier',
  2: 'On grade',
  3: 'Stretch',
};

/** Approved questions a standard should have at each difficulty. */
export const QUESTIONS_PER_DIFFICULTY_TARGET = 2;
/** How many a model writes per request. */
export const QUESTION_DRAFT_BATCH = 8;
export const MAX_STEM_LENGTH = 600;
export const MAX_CHOICE_LENGTH = 120;

// ---------------------------------------------------------------------------
// Exact numbers
// ---------------------------------------------------------------------------
// Answers are compared as fractions of big integers, never as floats: 0.1 + 0.2
// is 3/10 here, and 1/3 is not 0.333.

export interface Fraction {
  n: bigint;
  d: bigint;
}

const abs = (x: bigint) => (x < 0n ? -x : x);
function gcd(a: bigint, b: bigint): bigint {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
function fraction(n: bigint, d: bigint): Fraction | null {
  if (d === 0n) return null;
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d);
  return { n: n / g, d: d / g };
}
const add = (a: Fraction, b: Fraction) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Fraction, b: Fraction) => fraction(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Fraction, b: Fraction) => fraction(a.n * b.n, a.d * b.d);
const div = (a: Fraction, b: Fraction) => (b.n === 0n ? null : fraction(a.n * b.d, a.d * b.n));

export function fractionsEqual(a: Fraction, b: Fraction): boolean {
  return a.n === b.n && a.d === b.d;
}

export function formatFraction(f: Fraction): string {
  return f.d === 1n ? String(f.n) : `${f.n}/${f.d}`;
}

/** "1,250" or "-3.75" or ".5" */
function parseDecimal(text: string): Fraction | null {
  const match = /^([+-]?)(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d+))?$/.exec(text);
  if (!match || (!match[2] && !match[3])) return null;
  const whole = (match[2] ?? '').replace(/,/g, '') || '0';
  const decimals = match[3] ?? '';
  const n = BigInt(whole + decimals) * (match[1] === '-' ? -1n : 1n);
  return fraction(n, 10n ** BigInt(decimals.length));
}

/**
 * A typed numeric answer, exactly: a whole number, a decimal, a fraction
 * ("3/4", "-7/2") or a mixed number ("1 1/2", "-2 3/4"). Spaces around it, a
 * leading "+" and thousands commas are allowed; anything else is not a number.
 */
export function parseNumericAnswer(raw: string): Fraction | null {
  const text = raw
    .trim()
    .replace(/\$/g, '')
    .replace(/[−–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  const mixed = /^([+-]?)(\d+) (\d+)\s*\/\s*(\d+)$/.exec(text);
  if (mixed) {
    const sign = mixed[1] === '-' ? -1n : 1n;
    const d = BigInt(mixed[4]!);
    const n = BigInt(mixed[3]!);
    if (d === 0n || n >= d) return null;
    return fraction(sign * (BigInt(mixed[2]!) * d + n), d);
  }
  const ratio = /^([+-]?\d+)\s*\/\s*([+-]?\d+)$/.exec(text);
  if (ratio) return fraction(BigInt(ratio[1]!), BigInt(ratio[2]!));
  return parseDecimal(text.replace(/ /g, ''));
}

/**
 * Evaluates `compute`, the arithmetic a question's key must equal: numbers
 * (whole or decimal), + - * / ^ and parentheses, nothing else. Exact, and
 * null for anything it cannot evaluate (a stray letter, division by zero, a
 * fractional or huge power) -- which fails the check rather than passing it.
 */
export function evaluateExact(expression: string): Fraction | null {
  const source = expression.replace(/×|·/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
  if (!/^[\d\s.+\-*/^()]+$/.test(source)) return null;
  const matched = source.match(/\d*\.?\d+|[+\-*/^()]/g);
  if (!matched || matched.join('') !== source.replace(/\s+/g, '')) return null;
  const tokens: string[] = matched;
  let at = 0;

  const peek = () => tokens[at];
  function expressionLevel(): Fraction | null {
    let left = term();
    while (left && (peek() === '+' || peek() === '-')) {
      const op = tokens[at++];
      const right = term();
      if (!right) return null;
      left = op === '+' ? add(left, right) : sub(left, right);
    }
    return left;
  }
  function term(): Fraction | null {
    let left = unary();
    while (left && (peek() === '*' || peek() === '/')) {
      const op = tokens[at++];
      const right = unary();
      if (!right) return null;
      left = op === '*' ? mul(left, right) : div(left, right);
    }
    return left;
  }
  function unary(): Fraction | null {
    if (peek() === '-') {
      at += 1;
      const value = unary();
      return value && fraction(-value.n, value.d);
    }
    if (peek() === '+') {
      at += 1;
      return unary();
    }
    return power();
  }
  function power(): Fraction | null {
    const base = atom();
    if (!base || peek() !== '^') return base;
    at += 1;
    const exponent = unary();
    if (!exponent || exponent.d !== 1n || abs(exponent.n) > 64n) return null;
    let result: Fraction | null = { n: 1n, d: 1n };
    for (let i = 0n; i < abs(exponent.n) && result; i += 1n) result = mul(result, base);
    return result && exponent.n < 0n ? div({ n: 1n, d: 1n }, result) : result;
  }
  function atom(): Fraction | null {
    const token = tokens[at++];
    if (token === '(') {
      const inner = expressionLevel();
      return tokens[at++] === ')' ? inner : null;
    }
    return token !== undefined && /^\d*\.?\d+$/.test(token) ? parseDecimal(token) : null;
  }

  const value = expressionLevel();
  return at === tokens.length ? value : null;
}

/** A choice's text as compared: no maths delimiters, spacing or case. */
export function normalizeChoice(text: string): string {
  return text.replace(/\$/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Whether `response` is the question's answer. Numeric questions compare
 * exactly, in any equivalent form. A choice matches the key's text, or its
 * value when both are numbers ("0.5" for "1/2").
 */
export function checkAnswer(
  question: { kind: QuestionKind; answer: string },
  response: string,
): boolean {
  if (question.kind === 'numeric') {
    const key = parseNumericAnswer(question.answer);
    const given = parseNumericAnswer(response);
    return Boolean(key && given && fractionsEqual(key, given));
  }
  if (normalizeChoice(question.answer) === normalizeChoice(response)) return true;
  const key = parseNumericAnswer(question.answer);
  const given = parseNumericAnswer(response);
  return Boolean(key && given && fractionsEqual(key, given));
}

// ---------------------------------------------------------------------------
// The code checks
// ---------------------------------------------------------------------------

export interface QuestionContent {
  kind: QuestionKind;
  stem: string;
  choices: string[];
  answer: string;
  compute: string | null;
  solution: string;
}

function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/\\[a-z]+/g, ' ')
      .split(/[^a-z0-9.]+/)
      .filter(Boolean),
  );
}

/** Two stems saying nearly the same thing with the same numbers. */
export function isNearDuplicate(a: string, b: string): boolean {
  const x = words(a);
  const y = words(b);
  if (x.size === 0 || y.size === 0) return false;
  let shared = 0;
  for (const word of x) if (y.has(word)) shared += 1;
  return shared / (x.size + y.size - shared) >= 0.9;
}

/**
 * Everything code can check about a question, as problems in plain words; an
 * empty list means it passed. `others` are the stems already on its standard.
 */
export function lintQuestion(question: QuestionContent, others: readonly string[] = []): string[] {
  const problems: string[] = [];
  const { kind, stem, choices, answer, compute, solution } = question;

  if (!stem.trim()) problems.push('The question is empty.');
  if (stem.length > MAX_STEM_LENGTH) problems.push(`The question is over ${MAX_STEM_LENGTH} characters.`);
  if (!solution.trim()) problems.push('There is no worked solution.');
  for (const [label, text] of [
    ['question', stem],
    ['solution', solution],
    ...choices.map((choice) => ['choice', choice] as const),
  ] as const) {
    if ((text.match(/\$/g) ?? []).length % 2 !== 0) problems.push(`The ${label} has an unclosed $…$.`);
  }
  if ([stem, solution, answer, ...choices].some((text) => containsSsn(text))) {
    problems.push('It contains something shaped like a Social Security number.');
  }

  if (kind === 'choice') {
    if (choices.length !== 4) problems.push('A choice question needs exactly four choices.');
    const normalized = choices.map(normalizeChoice);
    if (new Set(normalized).size !== normalized.length) problems.push('Two choices are the same.');
    if (normalized.some((text) => !text)) problems.push('A choice is empty.');
    if (choices.some((text) => text.length > MAX_CHOICE_LENGTH)) problems.push('A choice is too long.');
    if (normalized.some((text) => /\b(all|none) of the above\b/.test(text))) {
      problems.push('“All of the above” and “none of the above” are not allowed.');
    }
    const keyed = choices.filter((choice) => checkAnswer({ kind: 'choice', answer }, choice));
    if (keyed.length !== 1) {
      problems.push(keyed.length === 0 ? 'The answer is not one of the choices.' : 'More than one choice matches the answer.');
    }
  } else {
    if (choices.length > 0) problems.push('A numeric question has no choices.');
    if (!parseNumericAnswer(answer)) problems.push('The answer is not a number (whole, decimal, fraction or mixed number).');
  }

  if (compute?.trim()) {
    const computed = evaluateExact(compute);
    const key = parseNumericAnswer(answer);
    if (!computed) problems.push('The calculation behind the answer could not be worked out.');
    else if (!key) problems.push('The answer has a calculation but is not a number.');
    else if (!fractionsEqual(computed, key)) {
      problems.push(`The calculation gives ${formatFraction(computed)}, not the answer ${answer}.`);
    }
  }

  if (others.some((other) => isNearDuplicate(stem, other))) {
    problems.push('It is nearly the same as another question on this standard.');
  }
  return problems;
}

// ---------------------------------------------------------------------------
// What a model returns, and what a person edits
// ---------------------------------------------------------------------------

const modelText = (max: number) => z.string().max(max);

/** One question as the writing model returns it (the tool's input schema). */
export const questionDraftSchema = z.object({
  skill: modelText(120).describe('The specific skill within the standard, in a few words.'),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).describe('1 easier, 2 on grade, 3 stretch.'),
  kind: z.enum(QUESTION_KINDS),
  stem: modelText(MAX_STEM_LENGTH).describe('The question, with maths in $...$ (LaTeX).'),
  choices: z
    .array(modelText(MAX_CHOICE_LENGTH))
    .max(4)
    .describe('Exactly four for a choice question; empty for a numeric one.'),
  answer: modelText(MAX_CHOICE_LENGTH).describe(
    'The correct choice, copied exactly, or the numeric answer (integer, decimal, a/b or "w n/d").',
  ),
  compute: modelText(200).describe(
    'Arithmetic using only numbers and + - * / ^ ( ) that equals the answer exactly; empty if the answer is not a calculation.',
  ),
  solution: modelText(1200).describe('A short worked solution.'),
});
export type QuestionDraft = z.infer<typeof questionDraftSchema>;

export const questionDraftBatchSchema = z.object({
  questions: z.array(questionDraftSchema).max(12),
  note: modelText(400).describe('Anything the reviewer should know, e.g. why fewer were written.'),
});

/** The blind solver's verdict on one question. */
export const questionVerdictSchema = z.object({
  ref: modelText(40).describe('The ref the question was given under.'),
  work: modelText(2000).describe('Your working, step by step, before the answer.'),
  final_answer: modelText(MAX_CHOICE_LENGTH).describe(
    'For a choice question, the chosen option copied exactly; otherwise the number.',
  ),
  single_answer: z.boolean().describe('Exactly one answer is defensible.'),
  aligned: z.boolean().describe('It tests the stated standard.'),
  grade_appropriate: z.boolean().describe('Its numbers, words and difficulty suit the grade.'),
  error_free: z.boolean().describe('No mistakes in the wording, maths or choices.'),
  issues: modelText(400).describe('What is wrong, if anything; empty otherwise.'),
});
export type QuestionVerdict = z.infer<typeof questionVerdictSchema>;

export const questionVerdictBatchSchema = z.object({
  results: z.array(questionVerdictSchema).max(12),
});

/** What the checks found, kept on the question for the reviewer. */
export interface QuestionChecks {
  lint: string[];
  solve: null | {
    answer: string;
    agreed: boolean;
    single_answer: boolean;
    aligned: boolean;
    grade_appropriate: boolean;
    error_free: boolean;
    issues: string;
    work: string;
    run_id: string;
    at: string;
  };
  /** Phase 42: a tutor flagged it in Question Quest, with their reason. */
  quest_flag?: { note: string; by: string; at: string };
}

/** Why a checked question would not be `checked`, in plain words. */
export function checkProblems(checks: QuestionChecks): string[] {
  const problems = [...checks.lint];
  if (checks.quest_flag) problems.push(`A tutor flagged it in Question Quest: ${checks.quest_flag.note}`);
  const solve = checks.solve;
  if (!solve) return problems;
  if (!solve.agreed) problems.push(`The blind solve answered ${solve.answer}.`);
  if (!solve.single_answer) problems.push('The solver found more than one defensible answer.');
  if (!solve.aligned) problems.push('The solver says it does not test this standard.');
  if (!solve.grade_appropriate) problems.push('The solver says it does not suit the grade.');
  if (!solve.error_free) problems.push('The solver found a mistake in it.');
  return problems;
}

const bankText = (max: number, required?: string) =>
  refuseSsn(required ? z.string().trim().min(1, required).max(max) : z.string().trim().max(max));

/** A person's edit. Saving it clears the blind solve: the question must be checked again. */
export const questionUpdateSchema = z
  .object({
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    kind: z.enum(QUESTION_KINDS),
    stem: bankText(MAX_STEM_LENGTH, 'Write the question.'),
    choices: z.array(bankText(MAX_CHOICE_LENGTH)).max(4),
    answer: bankText(MAX_CHOICE_LENGTH, 'Give the answer.'),
    compute: bankText(200).nullable(),
    solution: bankText(1200, 'Give a worked solution.'),
  })
  .partial();
export type QuestionUpdateInput = z.infer<typeof questionUpdateSchema>;

export const questionDraftRequestSchema = z.object({
  topic_id: z.string().min(1).max(64),
  count: z.number().int().min(1).max(12).default(QUESTION_DRAFT_BATCH),
});
export type QuestionDraftRequest = z.input<typeof questionDraftRequestSchema>;

export const questionCheckRequestSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(QUESTION_DRAFT_BATCH),
});

export const questionTopicUpdateSchema = z.object({ needs_figure: z.boolean() });

export const questionListQuerySchema = z.object({
  topic_id: z.string().max(64).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  level_id: z.string().max(64).optional(),
  /** Phase 51: only questions a space the platform does not trust for Quest suggested approving. */
  suggested: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export interface Question {
  id: string;
  topic_id: string;
  topic_code: string;
  topic_name: string;
  level_id: string;
  level_name: string;
  difficulty: QuestionDifficulty;
  kind: QuestionKind;
  skill: string | null;
  stem: string;
  choices: string[];
  answer: string;
  compute: string | null;
  solution: string;
  status: QuestionStatus;
  checks: QuestionChecks;
  source: 'ai' | 'manual';
  reviewed_by_name: string | null;
  /** 'console', 'quest' (a tutor in Question Quest) or 'quest_consensus' (two correct answers); null before. */
  approved_via: QuestionApprovedVia | null;
  reviewed_at: string | null;
  /** Phase 51: how many spaces suggested approving it (their Quest reviews are not trusted). */
  suggestions: number;
  times_used: number;
  times_correct: number;
  created_at: string;
  updated_at: string;
}

/** One standard's row in the coverage view. */
export interface QuestionCoverageTopic {
  topic_id: string;
  code: string;
  name: string;
  unit: string | null;
  description: string | null;
  needs_figure: boolean;
  /** Approved, by difficulty 1-3. */
  approved: [number, number, number];
  checked: number;
  flagged: number;
  draft: number;
}

export interface QuestionCoverageLevel {
  level_id: string;
  name: string;
  topics: QuestionCoverageTopic[];
}

/** Whether a standard has its target of approved questions at every difficulty. */
export function topicCovered(topic: Pick<QuestionCoverageTopic, 'approved'>): boolean {
  return topic.approved.every((count) => count >= QUESTIONS_PER_DIFFICULTY_TARGET);
}
