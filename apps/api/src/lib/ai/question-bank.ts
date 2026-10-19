import {
  QUESTION_DIFFICULTY_LABELS,
  evaluateExact,
  formatFraction,
  type QuestionDraft,
  type QuestionVerdict,
} from '@tmi/shared';

// The question bank's two tasks: what the writer and the blind solver are told,
// and what the fake answers in their place. The prompts use only the catalog's
// own text (code, name, summary) -- never NCDPI's official statements, whose
// terms allow non-commercial use only (docs/curricula/sources.md).

export interface BankStandard {
  code: string;
  name: string;
  description: string | null;
  unit: string | null;
  level_name: string;
}

export const DRAFT_TOOL = {
  name: 'submit_questions',
  description: 'Submit the questions you wrote for this standard.',
};

export const CHECK_TOOL = {
  name: 'submit_verdicts',
  description: 'Submit your solution and verdict for each question.',
};

export function draftSystemPrompt(): string {
  return `You write questions for a free online maths check-up taken by students at home, \
on a phone or a computer, with no one helping. A wrong answer key or an ambiguous question misplaces a \
child, so correctness comes before everything else.

Rules for every question:
- Test exactly one skill of the given standard, at that grade. Use numbers, words and contexts a student \
in that grade meets in class; keep the reading level at or below the grade.
- Text only. Never refer to a picture, graph, table, number line or diagram that is not written out in the \
question. If the standard cannot be tested fairly without one, write fewer questions (or none) and say so in "note".
- Exactly one correct answer. Give every number and unit the student needs. No trick wording.
- Neutral, everyday contexts. No real people, brands, religions or politics; use simple first names.
- Maths goes in $...$ using LaTeX (\\frac{3}{4}, \\times, \\div, x^2).
- "choice" questions: exactly four options, one correct, the three others each the result of a specific \
common mistake. Options similar in form and length. Never "all of the above" or "none of the above". Put \
the correct option in varying positions. "answer" is the correct option copied exactly.
- "numeric" questions: the answer is a single number written as an integer, a decimal, a fraction a/b, or \
a mixed number "w n/d" -- nothing else (put units in the question: "in centimeters"). "choices" is empty.
- "compute": when the answer is the result of a calculation, an expression using only numbers and \
+ - * / ^ ( ) that equals the answer exactly (for 3/4 of 24, "3/4*24"). For a choice question whose correct \
option is a number, it equals that number. Otherwise an empty string.
- "solution": a short worked solution a parent could follow.
- Work each answer out carefully before writing it down, and check it.
- Do not repeat or closely imitate any question listed as already written.`;
}

export function draftPrompt(standard: BankStandard, count: number, existing: readonly string[]): string {
  const spread = [1, 2, 3]
    .map((d) => `${QUESTION_DIFFICULTY_LABELS[d as 1 | 2 | 3].toLowerCase()} (${d})`)
    .join(', ');
  const already = existing.length
    ? `\nAlready written for this standard (do not repeat):\n${existing.map((stem) => `- ${stem}`).join('\n')}`
    : '';
  return `Standard ${standard.code}: ${standard.name}
Grade or course: ${standard.level_name}
Strand: ${standard.unit ?? '—'}
What it covers: ${standard.description ?? standard.name}

Write ${count} questions for this standard, spread across difficulty ${spread}, about a third each, \
covering different skills within it. Mix "choice" and "numeric" where both suit the skill.${already}`;
}

export function checkSystemPrompt(): string {
  return `You check questions for a maths check-up taken by students at home. For each \
question, solve it yourself from scratch, carefully, showing your working; you are not given the intended \
answer. Then judge it strictly:
- single_answer: exactly one answer is defensible as written.
- aligned: it tests the stated standard.
- grade_appropriate: its numbers, words and difficulty suit the stated grade.
- error_free: no mistake in the wording, the maths, or the options (for a choice question, exactly one \
option is correct).
Say what is wrong in "issues", or leave it empty. For a choice question, final_answer is the option you \
chose, copied exactly; otherwise it is the number (integer, decimal, a/b, or "w n/d").`;
}

export interface CheckItem {
  ref: string;
  stem: string;
  choices: string[];
}

export function checkPrompt(standard: BankStandard, items: readonly CheckItem[]): string {
  const questions = items
    .map((item) => {
      const options = item.choices.length
        ? `\nOptions:\n${item.choices.map((choice) => `- ${choice}`).join('\n')}`
        : '\n(Answer with a number.)';
      return `[${item.ref}]\n${item.stem}${options}`;
    })
    .join('\n\n');
  return `Standard ${standard.code}: ${standard.name}
Grade or course: ${standard.level_name}
What it covers: ${standard.description ?? standard.name}

Solve and judge each question. Give one verdict per question, using its ref.

${questions}`;
}

/** Choices in a fresh order, so the solver cannot lean on the key's position. */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// The fake (locally and in tests)
// ---------------------------------------------------------------------------
// It writes sums the fake solver can work out from the stem, so the whole path
// runs for real: code checks, blind solve, flags. The last question of a batch
// of three or more carries a wrong key, so a flag is always exercised.

export function fakeDraft(standard: BankStandard, count: number, offset: number): {
  questions: QuestionDraft[];
  note: string;
} {
  const questions = Array.from({ length: count }, (_, index): QuestionDraft => {
    const i = offset + index;
    const a = 12 + 7 * i;
    const b = 5 + 3 * i;
    const sum = a + b;
    const wrong = count >= 3 && index === count - 1;
    const key = String(wrong ? sum + 1 : sum);
    const choice = i % 4 === 3;
    const options = [sum, sum + 1, sum - 1, sum + 10].map(String);
    return {
      skill: 'Adding whole numbers',
      difficulty: ((index % 3) + 1) as 1 | 2 | 3,
      kind: choice ? 'choice' : 'numeric',
      stem: `${standard.code}, question ${i + 1}: work out $${a} + ${b}$.`,
      choices: choice ? [...options.slice(i % 4), ...options.slice(0, i % 4)] : [],
      answer: key,
      compute: wrong ? '' : `${a}+${b}`,
      solution: `$${a} + ${b} = ${sum}$.`,
    };
  });
  return { questions, note: '' };
}

export function fakeCheck(items: readonly CheckItem[]): { results: QuestionVerdict[] } {
  return {
    results: items.map((item) => {
      const expression = /\$([^$]+)\$/.exec(item.stem)?.[1] ?? '';
      const value = evaluateExact(expression);
      const answer = value ? formatFraction(value) : '?';
      return {
        ref: item.ref,
        work: `${expression} = ${answer}`,
        final_answer: item.choices.find((choice) => choice === answer) ?? answer,
        single_answer: true,
        aligned: true,
        grade_appropriate: true,
        error_free: true,
        issues: '',
      };
    }),
  };
}
