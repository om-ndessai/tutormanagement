import { readdirSync, readFileSync } from 'node:fs';
import {
  checkAnswer,
  evaluateExact,
  formatFraction,
  lintQuestion,
  parseNumericAnswer,
  redact,
  restore,
  type QuestionContent,
} from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * The AI layer and the question bank (Phase 36, docs/ai-platform-plan.md).
 *
 * The bank must be trustworthy before any child sees it, so the parts that
 * decide trust are pinned here: exact arithmetic, answer matching, the code
 * checks, and the rule that only a question every check passed can be approved.
 * Locally the model is the fake (lib/ai/question-bank.ts): it writes sums whose
 * blind solve it can work out, and one wrong key per batch, so a flag is
 * always exercised. It costs nothing.
 */

/** NC 2026's levels in the bank: every one since 2026-10-22, in catalog order. */
const NC_LEVELS = [
  ...['NC26.K', 'NC26.1', 'NC26.2', 'NC26.3', 'NC26.4', 'NC26.5', 'NC26.6', 'NC26.7', 'NC26.8', 'NC26.M1'],
  ...['NC26.M2', 'NC26.ALR', 'NC26.ASDS', 'NC26.MSM'],
];

/** NC 2017's levels in the bank, since 2026-10-23 (docs/question-bank-nc-2017.md), after NC 2026's. */
const NC17_LEVELS = [
  ...['NC17.K', 'NC17.1', 'NC17.2', 'NC17.3', 'NC17.4', 'NC17.5', 'NC17.6', 'NC17.7', 'NC17.8'],
  ...['NC17.M1', 'NC17.M2', 'NC17.M3', 'NC17.M4', 'NC17.PC'],
];

const value = (expression: string) => {
  const result = evaluateExact(expression);
  return result ? formatFraction(result) : null;
};

const numeric = (answer: string, extra: Partial<QuestionContent> = {}): QuestionContent => ({
  kind: 'numeric',
  stem: 'What is $6 \\times 7$?',
  choices: [],
  answer,
  compute: null,
  solution: '$6 \\times 7 = 42$.',
  ...extra,
});

test.describe('the question bank’s arithmetic and checks', () => {
  test('evaluates exactly, and refuses what it cannot', () => {
    expect(value('0.1 + 0.2')).toBe('3/10');
    expect(value('3/4*24')).toBe('18');
    expect(value('2^10 - (3 + 4) * 2')).toBe('1010');
    expect(value('-2^2')).toBe('-4');
    expect(value('(1/3) * 3')).toBe('1');
    expect(value('2^-2')).toBe('1/4');
    expect(value('12 ÷ 4 × 3')).toBe('9');
    for (const bad of ['1/0', '2^0.5', 'x+1', '3 +', '(2', '2)', 'alert(1)', '']) {
      expect(value(bad), bad).toBeNull();
    }
  });

  test('reads an answer in any equivalent form', () => {
    const same = ['3/4', '0.75', '.75', '6/8', ' 3 / 4 ', '$0.75$'];
    for (const form of same) expect(checkAnswer({ kind: 'numeric', answer: '3/4' }, form), form).toBe(true);
    expect(checkAnswer({ kind: 'numeric', answer: '1 1/2' }, '3/2')).toBe(true);
    expect(checkAnswer({ kind: 'numeric', answer: '-2 3/4' }, '-2.75')).toBe(true);
    expect(checkAnswer({ kind: 'numeric', answer: '12000' }, '12,000')).toBe(true);
    expect(checkAnswer({ kind: 'numeric', answer: '0.3' }, '0.33')).toBe(false);
    expect(checkAnswer({ kind: 'numeric', answer: '5' }, 'five')).toBe(false);
    expect(parseNumericAnswer('1 5/4')).toBeNull(); // not a mixed number
    expect(parseNumericAnswer('1,23')).toBeNull();
    // A choice matches its text, or its value when both are numbers.
    expect(checkAnswer({ kind: 'choice', answer: '$\\frac{1}{2}$' }, '$\\frac{1}{2}$')).toBe(true);
    expect(checkAnswer({ kind: 'choice', answer: '1/2' }, '0.5')).toBe(true);
    expect(checkAnswer({ kind: 'choice', answer: 'Triangle' }, 'triangle ')).toBe(true);
    expect(checkAnswer({ kind: 'choice', answer: 'Triangle' }, 'Square')).toBe(false);
  });

  test('the code checks catch a wrong key, a broken choice set and a near-copy', () => {
    expect(lintQuestion(numeric('42', { compute: '6*7' }))).toEqual([]);
    expect(lintQuestion(numeric('41', { compute: '6*7' }))).toEqual(['The calculation gives 42, not the answer 41.']);
    expect(lintQuestion(numeric('forty-two'))).toContain('The answer is not a number (whole, decimal, fraction or mixed number).');
    expect(lintQuestion(numeric('42', { stem: 'What is $6 \\times 7?' }))).toContain('The question has an unclosed $…$.');
    expect(lintQuestion(numeric('42', { stem: 'Is 123-45-6789 right?' }))).toContain(
      'It contains something shaped like a Social Security number.',
    );

    const choice = (choices: string[], answer: string) =>
      lintQuestion({ kind: 'choice', stem: 'Which is half?', choices, answer, compute: null, solution: 'Half.' });
    expect(choice(['1/2', '1/3', '2/3', '1/4'], '1/2')).toEqual([]);
    expect(choice(['1/2', '1/3', '2/3'], '1/2')).toContain('A choice question needs exactly four choices.');
    expect(choice(['1/2', '1/3', '2/3', '1/4'], '3/4')).toContain('The answer is not one of the choices.');
    expect(choice(['1/2', '0.5', '2/3', '1/4'], '1/2')).toContain('More than one choice matches the answer.');
    expect(choice(['1/2', '1/2', '2/3', '1/4'], '1/2')).toContain('Two choices are the same.');
    expect(choice(['1/2', '1/3', '2/3', 'None of the above'], '1/2')).toContain(
      '“All of the above” and “none of the above” are not allowed.',
    );

    const stem = 'Maya has 24 stickers and gives away 3/4 of them. How many does she give away?';
    expect(lintQuestion(numeric('18', { stem }), [stem.replace('Maya', 'maya')])).toContain(
      'It is nearly the same as another question on this standard.',
    );
    expect(lintQuestion(numeric('18', { stem }), [stem.replace('24', '36')])).toEqual([]);
  });

  test('redaction swaps people for tokens and puts them back', () => {
    const text = 'Sofia Okafor (sofia@example.com, 919-555-0134) and Sofia again.';
    const { text: sent, tokens } = redact(text, ['Sofia', 'Sofia Okafor']);
    expect(sent).not.toMatch(/Sofia|example\.com|555/);
    expect(restore(sent, tokens)).toBe(text);
  });

  test('every question kept in the repository passes the code checks', () => {
    const dir = new URL('../../apps/api/db/questions/', import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const { questions } = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as { questions: (QuestionContent & { id: string; topic_id: string })[] };
      for (const q of questions) {
        const others = questions.filter((o) => o.topic_id === q.topic_id && o.id !== q.id).map((o) => o.stem);
        expect(lintQuestion(q, others), `${file} ${q.id}`).toEqual([]);
      }
    }
  });
});

test.describe('the question bank’s rules', () => {
  test('nobody but a platform admin reaches it', async ({ as }) => {
    for (const who of ['admin', 'tutor', 'parent', 'student'] as const) {
      const page = await as(who);
      for (const path of ['/api/platform/questions/coverage', '/api/platform/questions', '/api/platform/ai/tasks', '/api/platform/ai/runs']) {
        expect((await page.request.get(path)).status(), `${who} ${path}`).toBe(403);
      }
      const draft = await page.request.post('/api/platform/questions/draft', { data: { topic_id: 'NC26.6.ANR.1' } });
      expect(draft.status(), who).toBe(403);
    }
  });

  test('Phase 41: the bank covers Beast Academy’s chapters, after NC, and so does the Assessment where it is offered', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const levels = await unwrap<{ level_id: string; topics: { topic_id: string }[] }[]>(
      await platform.request.get('/api/platform/questions/coverage'),
      'coverage',
    );
    expect(levels.map((l) => l.level_id)).toEqual([
      ...NC_LEVELS,
      ...NC17_LEVELS,
      ...['BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO'],
      ...['MK12', 'MK34'],
    ]);
    expect(levels.find((l) => l.level_id === 'BA3')?.topics.map((t) => t.topic_id)).toContain('BA3.06');
    // A chapter is a standard the console can write for, like any other.
    const written = await unwrap<{ questions: { topic_id: string }[] }>(
      await platform.request.post('/api/platform/questions/draft', { data: { topic_id: 'BA3.06', count: 4 } }),
      'writing for a chapter',
    );
    expect(written.questions.every((q) => q.topic_id === 'BA3.06')).toBe(true);

    // The Assessment menu offers them too (owner, 2026-10-19), to an organization whose curriculum
    // list includes Beast Academy (A's does); they are checked, not approved, so they are drawn only
    // while the organization includes questions not yet reviewed.
    const admin = await as('admin');
    const setA = (data: Record<string, boolean>) => admin.request.patch('/api/organization/settings', { data });
    expect((await setA({ canvas_assessments_unreviewed: true })).status()).toBe(200);
    try {
      const offered = await unwrap<{ level_id: string; label: string; available: number }[]>(
        await admin.request.get('/api/canvas-assessments/levels'),
        'assessment levels',
      );
      // A offers Beast Academy, not NC 2017 or Math Kangaroo: every level but theirs.
      expect(offered.map((l) => l.level_id)).toEqual(
        levels.map((l) => l.level_id).filter((id) => !id.startsWith('NC17.') && !id.startsWith('MK')),
      );
      const ba3 = offered.find((l) => l.level_id === 'BA3')!;
      expect(ba3.label).toBe('BA3');
      expect(ba3.available).toBeGreaterThan(0);
      const [sofia] = await unwrap<{ id: string }[]>(await admin.request.get('/api/users?search=Sofia'), 'Sofia');
      const started = await unwrap<{ id: string; unreviewed_questions: number; question_count: number }>(
        await admin.request.post('/api/canvas-assessments', { data: { student_user_id: sofia.id, level_id: 'BA3' } }),
        'starting a BA3 assessment',
      );
      // Every question drawn is unreviewed, except any a Quest review approved earlier in the run
      // (the bank is a sample since Phase 49, so an approved BA3 question is likely to be drawn).
      const approvedBa3 = await unwrap<unknown[]>(
        await platform.request.get('/api/platform/questions?level_id=BA3&status=approved&limit=200'),
        'approved at BA3',
      );
      expect(started.unreviewed_questions).toBeGreaterThan(0);
      expect(started.unreviewed_questions).toBeGreaterThanOrEqual(started.question_count - approvedBa3.length);
      await unwrap(await admin.request.post(`/api/canvas-assessments/${started.id}/discard`, { data: {} }), 'discarding');
    } finally {
      await setA({ canvas_assessments_unreviewed: false });
    }

    // B offers NC's standards only, both editions: no Beast Academy level, and asking for one is refused.
    const adminB = await as('orgBAdmin', { org: 'riverside' });
    const setB = (data: Record<string, boolean>) => adminB.request.patch('/api/organization/settings', { data });
    expect((await setB({ canvas_assessments: true })).status()).toBe(200);
    try {
      const offeredB = await unwrap<{ level_id: string; label: string }[]>(
        await adminB.request.get('/api/canvas-assessments/levels'),
        'B levels',
      );
      expect(offeredB.map((l) => l.level_id)).toEqual([...NC_LEVELS, ...NC17_LEVELS]);
      expect(offeredB.find((l) => l.level_id === 'NC17.4')?.label).toBe('G4 (2017)');
      const [lily] = await unwrap<{ id: string }[]>(await adminB.request.get('/api/users?search=Lily%20Chen'), 'Lily');
      const refused = await adminB.request.post('/api/canvas-assessments', { data: { student_user_id: lily.id, level_id: 'BA3' } });
      expect(refused.status()).toBe(422);
    } finally {
      await setB({ canvas_assessments: false });
    }
  });

  test('NC 2017: its levels reach only an organization that offers it, in the Assessment menu, Quest and Quest Games', async ({ as }) => {
    // A offers Beast Academy only: no NC 2017 level anywhere, and setting one as a Quest level is refused.
    const admin = await as('admin');
    const setA = (data: Record<string, boolean>) => admin.request.patch('/api/organization/settings', { data });
    expect((await setA({ canvas_assessments: true, gamify_question_quest: true })).status()).toBe(200);
    try {
      const games = await unwrap<{ level_id: string }[]>(await admin.request.get('/api/quest/games/levels'), 'A game levels');
      expect(games.some((l) => l.level_id.startsWith('NC17.'))).toBe(false);
      expect(games.some((l) => l.level_id === 'BA3')).toBe(true);
      const [sofia] = await unwrap<{ id: string }[]>(await admin.request.get('/api/users?search=Sofia'), 'Sofia');
      const refused = await admin.request.put(`/api/quest/students/${sofia.id}/level`, { data: { level_id: 'NC17.4' } });
      expect(refused.status()).toBe(422);
      const started = await admin.request.post('/api/canvas-assessments', { data: { student_user_id: sofia.id, level_id: 'NC17.4' } });
      expect(started.status()).toBe(422);
    } finally {
      await setA({ canvas_assessments: false, gamify_question_quest: false });
    }

    // B offers both NC editions: NC 2017's levels are its to play and to set.
    const adminB = await as('orgBAdmin', { org: 'riverside' });
    const setB = (data: Record<string, boolean>) => adminB.request.patch('/api/organization/settings', { data });
    expect((await setB({ gamify_question_quest: true })).status()).toBe(200);
    try {
      const games = await unwrap<{ level_id: string; label: string }[]>(await adminB.request.get('/api/quest/games/levels'), 'B game levels');
      expect(games.map((l) => l.level_id)).toEqual([...NC_LEVELS, ...NC17_LEVELS]);
      const [lily] = await unwrap<{ id: string }[]>(await adminB.request.get('/api/users?search=Lily%20Chen'), 'Lily');
      const set = await unwrap<{ level_id: string | null } | null>(
        await adminB.request.put(`/api/quest/students/${lily.id}/level`, { data: { level_id: 'NC17.4' } }),
        'setting an NC 2017 level',
      );
      expect(set?.level_id).toBe('NC17.4');
      await unwrap(await adminB.request.put(`/api/quest/students/${lily.id}/level`, { data: { level_id: null } }), 'clearing it');
    } finally {
      await setB({ gamify_question_quest: false });
    }
  });

  test('written, checked by code and blind, approved only once every check passed', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const written = await unwrap<{ questions: any[] }>(
      await platform.request.post('/api/platform/questions/draft', { data: { topic_id: 'NC26.6.ANR.1', count: 4 } }),
      'writing',
    );
    expect(written.questions).toHaveLength(4);
    expect(written.questions.every((q) => q.status === 'draft' && q.checks.solve === null)).toBe(true);
    const ids = written.questions.map((q) => q.id);

    // Not yet solved blind: refused.
    expect((await platform.request.post(`/api/platform/questions/${ids[0]}/approve`)).status()).toBe(409);

    const checked = await unwrap<any[]>(await platform.request.post('/api/platform/questions/check', { data: { ids } }), 'checking');
    expect(checked.map((q) => q.status)).toEqual(['checked', 'checked', 'checked', 'flagged']);
    const wrong = checked[3];
    expect(wrong.checks.solve.agreed).toBe(false);

    // A flagged question cannot be approved; corrected, it must be solved again first.
    expect((await platform.request.post(`/api/platform/questions/${wrong.id}/approve`)).status()).toBe(409);
    const fixed = await unwrap<any>(
      await platform.request.patch(`/api/platform/questions/${wrong.id}`, { data: { answer: wrong.checks.solve.answer } }),
      'fixing',
    );
    expect(fixed.status).toBe('draft');
    expect(fixed.checks.solve).toBeNull();
    const rechecked = await unwrap<any[]>(
      await platform.request.post('/api/platform/questions/check', { data: { ids: [wrong.id] } }),
      'rechecking',
    );
    expect(rechecked[0].status).toBe('checked');

    const approved = await unwrap<any>(await platform.request.post(`/api/platform/questions/${ids[0]}/approve`), 'approving');
    expect(approved.status).toBe('approved');
    expect(approved.reviewed_by_name).toBe('Nav Dessai');

    // Editing an approved question takes the approval away.
    const edited = await unwrap<any>(
      await platform.request.patch(`/api/platform/questions/${ids[0]}`, { data: { solution: 'Counted on.' } }),
      'editing',
    );
    expect(edited.status).toBe('draft');
    expect(edited.reviewed_by_name).toBeNull();

    // An SSN-shaped edit is refused outright.
    const ssn = await platform.request.patch(`/api/platform/questions/${ids[1]}`, { data: { stem: 'Is 123-45-6789 right?' } });
    expect(ssn.status()).toBe(422);

    // Retired, never deleted; restored, it starts again unchecked.
    expect((await unwrap<any>(await platform.request.post(`/api/platform/questions/${ids[1]}/retire`), 'retire')).status).toBe('retired');
    expect((await platform.request.post('/api/platform/questions/check', { data: { ids: [ids[1]] } })).status()).toBe(409);
    expect((await unwrap<any>(await platform.request.post(`/api/platform/questions/${ids[1]}/restore`), 'restore')).status).toBe('draft');

    // The log says what was done, never a question's words.
    const audit = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'audit');
    const lines = audit.filter((e) => e.action.startsWith('question'));
    expect(lines.map((e) => e.action)).toEqual(expect.arrayContaining(['question_bank.drafted', 'question_bank.checked', 'question.approved', 'question.updated']));
    for (const line of lines) expect(line.description).not.toContain('work out');
  });

  test('a task switched off or over its cap is refused, and the refusal is logged', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const draft = () => platform.request.post('/api/platform/questions/draft', { data: { topic_id: 'NC26.6.ANR.2', count: 2 } });
    try {
      await unwrap(await platform.request.patch('/api/platform/ai/tasks/question_bank.draft', { data: { enabled: false } }), 'off');
      const off = await draft();
      expect(off.status()).toBe(503);
      expect((await off.json()).error.code).toBe('ai_disabled');

      await unwrap(
        await platform.request.patch('/api/platform/ai/tasks/question_bank.draft', { data: { enabled: true, daily_cap_cents: 0 } }),
        'cap',
      );
      const capped = await draft();
      expect(capped.status()).toBe(429);
      expect((await capped.json()).error.code).toBe('ai_budget_exhausted');
    } finally {
      await platform.request.patch('/api/platform/ai/tasks/question_bank.draft', {
        data: { enabled: true, daily_cap_cents: 500, monthly_cap_cents: 2500 },
      });
    }
    const runs = await unwrap<any[]>(await platform.request.get('/api/platform/ai/runs?limit=5'), 'runs');
    expect(runs.slice(0, 2).map((r) => r.outcome)).toEqual(['refused_budget', 'refused_disabled']);
    // A run records what happened, never what was said.
    expect(Object.keys(runs[0]).sort()).toEqual(
      ['actor_name', 'cost_microdollars', 'created_at', 'detail', 'id', 'input_tokens', 'model', 'outcome', 'output_tokens', 'provider', 'task'],
    );
  });
});

test.describe('the question bank in the console', () => {
  test('a platform admin writes questions for a standard and reviews them', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await platform.goto('/platform/questions');
    await expect(platform.getByRole('heading', { name: 'Question bank' })).toBeVisible();
    // The fixture bank: 4.ANR.1 and 4.ANR.2 are at target.
    await expect(platform.getByTestId('bank-level-NC26.4')).toContainText('2 of 12 standards at target');

    // The repository's bank already holds questions on this standard; eight more join them.
    const before = (
      await unwrap<any[]>(await platform.request.get('/api/platform/questions?topic_id=NC26.7.ANR.1&limit=200'), 'listing')
    ).filter((q) => q.status !== 'retired').length;
    await platform.getByTestId('bank-level-NC26.7').getByRole('button', { name: /7\.ANR\.1/ }).click();
    await expect(platform.getByRole('heading', { name: /7\.ANR\.1/ })).toBeVisible();
    await platform.getByRole('button', { name: 'Write 8 questions' }).click();
    await expect(platform.getByRole('status')).toContainText('Done: 8 written, 7 passed every check, 1 flagged', { timeout: 20_000 });
    await expect(platform.getByTestId('question-card')).toHaveCount(before + 8);
    await expect(platform.locator('[data-testid="question-card"][data-status="flagged"]')).toContainText('does NOT match');

    // The review queue, by keyboard.
    await platform.goto('/platform/questions/review');
    const first = await platform.getByTestId('question-stem').textContent();
    // An approval writes into the loaded queue and counts; it never re-reads them, since each
    // re-read scans the whole bank in D1 (the account's daily read allowance is shared).
    const rereads: string[] = [];
    platform.on('request', (request) => {
      const url = new URL(request.url());
      if (request.method() === 'GET' && url.pathname.startsWith('/api/platform/questions')) rereads.push(url.pathname + url.search);
    });
    await platform.keyboard.press('a');
    await expect(platform.getByText('Approved.')).toBeVisible();
    await expect(platform.getByTestId('question-stem')).not.toHaveText(first ?? '');
    expect(rereads, 'an approval re-read the bank').toEqual([]);
    await platform.keyboard.press('n');
    await expect(platform.getByTestId('review-position')).toContainText('1 skipped');

    // The flagged one, corrected in the dialog, whose checks run as you type.
    await platform.goto('/platform/questions/NC26.7.ANR.1');
    await platform.getByRole('tab', { name: /Flagged/ }).click();
    const flagged = platform.getByTestId('question-card').first();
    await flagged.getByRole('button', { name: 'Edit' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel(/Calculation behind it/).fill('1+1');
    await expect(dialog.getByTestId('edit-checks')).toContainText('The calculation gives 2');
    await dialog.getByLabel(/Calculation behind it/).fill('');
    await expect(dialog.getByTestId('edit-checks')).toContainText('The code checks pass.');

    await platform.goto('/platform/ai');
    await expect(platform.getByTestId('ai-task-question_bank.draft')).toContainText('test stand-in');
    await expect(platform.getByTestId('ai-runs')).toContainText('question_bank.check');
  });
});
