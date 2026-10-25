// Question-bank fixtures for the app's tests (#54): a question and a coverage with sensible
// defaults, shaped as the API answers them.
import type { Question, QuestionCoverageLevel, QuestionCoverageTopic } from '@tmi/shared';

export function aQuestion(overrides: Partial<Question> = {}): Question {
  const id = overrides.id ?? 'q-1';
  return {
    id,
    topic_id: 'NC26.3.ANR.1',
    topic_code: '3.ANR.1',
    topic_name: 'Place value to 10,000',
    level_id: 'NC26.3',
    level_name: 'Grade 3',
    difficulty: 1,
    kind: 'choice',
    skill: 'Compare four numbers',
    stem: `Which number is the greatest? (${id})`,
    choices: ['3,908', '3,980', '3,890', '3,098'],
    answer: '3,980',
    compute: '3980',
    solution: 'Compare the hundreds, then the tens: $3{,}980$ is the greatest.',
    status: 'checked',
    checks: {
      lint: [],
      solve: {
        answer: '3,980',
        agreed: true,
        single_answer: true,
        aligned: true,
        grade_appropriate: true,
        error_free: true,
        issues: '',
        work: '$\\frac{3}{4}$ of the way: 3,980 is greatest.',
        run_id: 'run-1',
        at: '2026-10-17T18:00:00.000Z',
      },
    },
    source: 'ai',
    reviewed_by_name: null,
    approved_via: null,
    suggestions: 0,
    reviewed_at: null,
    times_used: 0,
    times_correct: 0,
    created_at: '2026-10-17T18:00:00.000Z',
    updated_at: '2026-10-17T18:00:00.000Z',
    ...overrides,
  };
}

export function aTopic(overrides: Partial<QuestionCoverageTopic> = {}): QuestionCoverageTopic {
  return {
    topic_id: 'NC26.3.ANR.1',
    code: '3.ANR.1',
    name: 'Place value to 10,000',
    unit: 'Algebraic and Numerical Reasoning',
    description: 'Read and write numbers to 10,000.',
    needs_figure: false,
    approved: [0, 0, 0],
    checked: 0,
    flagged: 0,
    draft: 0,
    ...overrides,
  };
}

export function aLevel(
  level_id: string,
  name: string,
  topics: QuestionCoverageTopic[],
): QuestionCoverageLevel {
  return { level_id, name, topics };
}
