import type { Page } from '@playwright/test';

import { PEOPLE, expect, test } from '../support/fixtures.js';
import { idOf, unwrap } from '../support/api.js';
import { latexToPlain, mathTextToPlain, parseStroke } from '@tmi/shared';

/**
 * Phase 38: the Assessment menu (beta). A student answers approved questions by hand, one per
 * page, with nothing marked; on submitting, the tutor gets a PDF (docs/canvas-assessment-plan.md).
 * Organization A has it on in the seed; B has it off.
 */

/** A stroke drawn with the mouse across the canvas, from and to fractions of its box. */
async function draw(page: Page, from: [number, number], to: [number, number]) {
  await page.getByTestId('assessment-canvas').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('assessment-canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    await page.mouse.move(
      box.x + box.width * (from[0] + (to[0] - from[0]) * t),
      box.y + box.height * (from[1] + (to[1] - from[1]) * t),
    );
  }
  await page.mouse.up();
}

/** What the browser keeps of the work in progress, by question. */
async function savedStrokes(page: Page, id: string): Promise<Record<string, unknown[]>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').pages ?? {}, `aimtrue.canvas-assessment.${id}`);
}

/** The PDF format's own bones: header, end, and a cross-reference table that points at its objects. */
function checkPdf(bytes: Buffer): number {
  const text = bytes.toString('latin1');
  expect(text.startsWith('%PDF-1.4')).toBe(true);
  expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  const start = Number(/startxref\n(\d+)/.exec(text)![1]);
  const [, , count] = /^xref\n(\d+) (\d+)\n/.exec(text.slice(start))!;
  const entries = text.slice(start).split('\n').slice(2, 2 + Number(count));
  entries.forEach((entry, id) => {
    if (id > 0) expect(text.startsWith(`${id} 0 obj`, Number(entry.slice(0, 10)))).toBe(true);
  });
  return Number(/\/Count (\d+)/.exec(text)![1]);
}

test.describe('the Assessment menu (beta)', () => {
  test('the handwriting format and the maths as plain text', () => {
    expect(parseStroke('4 10 20 30 40')).toEqual({ width: 4, points: [10, 20, 30, 40] });
    expect(parseStroke('4 10 20 30')).toBeNull();
    expect(parseStroke('4 1001 20')).toBeNull();
    expect(parseStroke('0 10 20')).toBeNull();
    expect(parseStroke('4 1e3 20')).toBeNull();
    expect(latexToPlain('\\frac{3}{4} + 1\\frac{1}{2}')).toBe('3/4 + 1 1/2');
    expect(mathTextToPlain('Area $= \\pi r^2$ and $2{,}908 \\times 3 \\le 9{,}000$, $45^\\circ$')).toBe(
      'Area = pi r² and 2,908 × 3 <= 9,000, 45°',
    );
    expect(mathTextToPlain('$\\sqrt{16}$ and $\\overline{AB} \\cong \\overline{CD}$')).toBe(
      'sqrt(16) and AB congruent to CD',
    );
  });

  test('an organization switches it on and off', async ({ as }) => {
    const admin = await as('orgBAdmin', { org: 'riverside' });
    expect((await admin.request.get('/api/canvas-assessments')).status()).toBe(403);
    await admin.goto('/organization');
    const nav = admin.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: /Assessment/ })).toHaveCount(0);

    await admin.getByRole('switch', { name: 'Assessment menu' }).click();
    await expect(nav.getByRole('link', { name: /Assessment/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Assessment/ })).toContainText('Beta');
    expect((await admin.request.get('/api/canvas-assessments')).status()).toBe(200);

    await admin.getByRole('switch', { name: 'Assessment menu' }).click();
    await expect(nav.getByRole('link', { name: /Assessment/ })).toHaveCount(0);
    expect((await admin.request.get('/api/canvas-assessments')).status()).toBe(403);
  });

  test('written by hand, revisited, submitted, and a PDF for the tutor alone', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/assessments');
    await expect(admin.getByRole('heading', { name: 'Assessment', exact: true })).toBeVisible();

    await admin.getByLabel('Student').click();
    await admin.getByRole('option', { name: PEOPLE.student.name }).click();
    await admin.getByLabel('Grade').click();
    await admin.getByRole('option', { name: /Grade 4/ }).click();
    await admin.getByTestId('assessment-begin').click();
    await expect(admin).toHaveURL(/\/assessments\/[0-9a-f-]{36}$/);
    const id = admin.url().split('/').at(-1)!;
    await expect(admin.getByRole('heading', { name: /Question 1 of/ })).toBeVisible();

    // A multiple-choice question is answered by choosing, with the canvas for working.
    const detail0 = await unwrap<any>(await admin.request.get(`/api/canvas-assessments/${id}`), 'the questions');
    // Pages 1 and 2 get writing below, so the choice is made on a later page.
    const choiceAt = detail0.questions.findIndex((q: any, i: number) => i >= 2 && q.kind === 'choice');
    expect(choiceAt, 'a multiple-choice question after page 2').toBeGreaterThanOrEqual(2);
    await admin.getByRole('button', { name: `Question ${choiceAt + 1}`, exact: true }).click();
    await expect(admin.getByRole('radiogroup', { name: 'Your answer' })).toBeVisible();
    await admin.getByTestId('assessment-choice-B').click();
    await expect(admin.getByTestId('assessment-choice-B')).toHaveAttribute('aria-checked', 'true');
    await admin.getByTestId('assessment-choice-A').click();
    await expect(admin.getByTestId('assessment-choice-B')).toHaveAttribute('aria-checked', 'false');
    await draw(admin, [0.3, 0.3], [0.5, 0.4]);
    await admin.getByRole('button', { name: 'Question 1', exact: true }).click();

    // Page 1, then page 2.
    await draw(admin, [0.1, 0.2], [0.4, 0.3]);
    await draw(admin, [0.2, 0.5], [0.3, 0.7]);
    await admin.getByRole('button', { name: 'Next' }).click();
    await expect(admin.getByRole('heading', { name: /Question 2 of/ })).toBeVisible();
    await draw(admin, [0.5, 0.5], [0.8, 0.6]);

    // Back to page 1: its writing is still there, and it can be changed.
    await admin.getByRole('button', { name: 'Question 1, has writing' }).click();
    await expect(admin.getByRole('heading', { name: /Question 1 of/ })).toBeVisible();
    let saved = await savedStrokes(admin, id);
    const first = detail0.questions[0].id;
    const second = detail0.questions[1].id;
    expect(saved[first]).toHaveLength(2);
    expect(saved[second]).toHaveLength(1);
    await admin.getByRole('button', { name: 'Undo' }).click();
    await admin.getByRole('button', { name: 'Eraser' }).click();
    await draw(admin, [0.05, 0.15], [0.45, 0.35]);
    await expect.poll(async () => (await savedStrokes(admin, id))[first]?.length).toBe(0);
    await admin.getByRole('button', { name: 'Pen' }).click();
    await draw(admin, [0.6, 0.1], [0.9, 0.4]);
    saved = await savedStrokes(admin, id);
    expect(saved[first]).toHaveLength(1);

    // Survives a reload: the work is kept in the browser until it is submitted.
    await admin.reload();
    await expect(admin.getByRole('button', { name: 'Question 2, has writing' })).toBeVisible();

    await admin.getByTestId('assessment-submit').click();
    await expect(admin.getByText(/questions have no answer yet/)).toBeVisible();
    await admin.getByTestId('assessment-submit-confirm').click();
    await expect(admin).toHaveURL(/\/assessments$/);
    const row = admin.getByTestId(`assessment-${id}`);
    await expect(row).toContainText('Submitted');
    await expect(row).toContainText('3 of');
    await expect(row).toContainText('choices correct');
    expect(await savedStrokes(admin, id)).toEqual({});

    // The PDF opens in the portal, drawn page by page -- never a download.
    await row.getByRole('link', { name: 'Open PDF' }).click();
    await expect(admin).toHaveURL(new RegExp(`/assessments/${id}/review$`));
    await expect(admin.getByTestId('pdf-viewer')).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
    await expect(admin.getByTestId('pdf-page')).toHaveCount(detail0.questions.length + 1);
    const summary = await unwrap<any>(await admin.request.get(`/api/canvas-assessments/${id}`), 'the summary');
    expect(summary.choices_answered).toBe(1);
    expect([0, 1]).toContain(summary.choices_correct);

    // The PDF: the student's tutor and the office open it; the student and their parent see the row only.
    const tutor = await as('tutor');
    const pdf = await tutor.request.get(`/api/canvas-assessments/${id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    const pages = checkPdf(await pdf.body());
    const detail = await unwrap<any>(await tutor.request.get(`/api/canvas-assessments/${id}`), 'the tutor reading it');
    expect(pages).toBe(detail.question_count + 1);

    for (const who of ['student', 'parentTutor'] as const) {
      const reader = await as(who);
      expect((await reader.request.get(`/api/canvas-assessments/${id}/pdf`)).status()).toBe(404);
      const shown = await unwrap<any>(await reader.request.get(`/api/canvas-assessments/${id}`), `${who} reading it`);
      expect(shown.status).toBe('submitted');
      expect(shown.questions).toBeNull();
      expect(shown.started_by_name).toBeNull();
      expect(shown.choices_correct).toBeNull();
      await reader.goto('/assessments');
      await expect(reader.getByTestId(`assessment-${id}`)).toContainText('Submitted');
      await expect(reader.getByTestId(`assessment-${id}`).getByRole('link', { name: 'Open PDF' })).toHaveCount(0);
    }

    // Submitted once: never again, and never discarded.
    expect((await admin.request.post(`/api/canvas-assessments/${id}/submit`, { data: { pages: [] } })).status()).toBe(409);
    expect((await admin.request.post(`/api/canvas-assessments/${id}/discard`, { data: {} })).status()).toBe(409);
  });

  test('an organization may try questions not yet reviewed', async ({ as }) => {
    const admin = await as('orgBAdmin', { org: 'riverside' });
    const set = (data: Record<string, boolean>) => admin.request.patch('/api/organization/settings', { data });
    expect((await set({ canvas_assessments: true })).status()).toBe(200);
    try {
      const approvedOnly = await unwrap<any[]>(await admin.request.get('/api/canvas-assessments/levels'), 'levels');
      expect(approvedOnly.find((l) => l.level_id === 'NC26.7').available).toBe(0);

      expect((await set({ canvas_assessments_unreviewed: true })).status()).toBe(200);
      const levels = await unwrap<any[]>(await admin.request.get('/api/canvas-assessments/levels'), 'levels');
      const grade7 = levels.find((l) => l.level_id === 'NC26.7');
      expect(grade7.available).toBeGreaterThan(0);
      expect(grade7.unreviewed).toBe(grade7.available);

      const [lily] = await unwrap<any[]>(await admin.request.get('/api/users?search=Lily%20Chen'), 'Lily');
      const started = await unwrap<any>(
        await admin.request.post('/api/canvas-assessments', { data: { student_user_id: lily.id, level_id: 'NC26.7' } }),
        'starting on unreviewed questions',
      );
      expect(started.unreviewed_questions).toBe(started.question_count);
      await unwrap<any>(
        await admin.request.post(`/api/canvas-assessments/${started.id}/submit`, { data: { pages: [] } }),
        'submitting',
      );
      // The tutor's PDF says so, on every such page.
      const pdf = await admin.request.get(`/api/canvas-assessments/${started.id}/pdf`);
      expect(pdf.status()).toBe(200);
      expect(checkPdf(await pdf.body())).toBe(started.question_count + 1);

      // The switch is on the Organization page, beside the menu's own.
      await admin.goto('/organization');
      await expect(admin.getByRole('switch', { name: 'Include questions not yet reviewed' })).toHaveAttribute('aria-checked', 'true');
    } finally {
      await set({ canvas_assessments_unreviewed: false });
      await set({ canvas_assessments: false });
    }
  });

  test('who may start one, and from what', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');
    const sofiaId = await idOf(admin, PEOPLE.student.email);
    const sanjayId = await idOf(admin, PEOPLE.studentTutor.email);
    const start = (page: Page, student: string, level = 'NC26.4') =>
      page.request.post('/api/canvas-assessments', { data: { student_user_id: student, level_id: level } });

    // Alex teaches Sofia, not Sanjay: Sanjay is "not found" to him.
    expect((await start(tutor, sofiaId)).status()).toBe(201);
    expect((await start(tutor, sanjayId)).status()).toBe(404);
    // A grade with no approved questions yet.
    expect((await start(admin, sofiaId, 'NC26.7')).status()).toBe(409);
    expect((await start(admin, sofiaId, 'NC99')).status()).toBe(422);

    // The questions go to whoever is taking it, never with the answer.
    const created = await unwrap<any>(await start(admin, sofiaId), 'starting');
    const taking = await unwrap<any>(await admin.request.get(`/api/canvas-assessments/${created.id}`), 'taking it');
    expect(taking.questions.length).toBeGreaterThan(0);
    for (const question of taking.questions) {
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('solution');
    }
    // Only its taker submits it; a student cannot submit the office's.
    const student = await as('student');
    expect((await student.request.post(`/api/canvas-assessments/${created.id}/submit`, { data: { pages: [] } })).status()).toBe(404);
    // A page for a question it did not ask, and a stroke off the page.
    const bad = (pages: unknown) => admin.request.post(`/api/canvas-assessments/${created.id}/submit`, { data: { pages } });
    expect((await bad([{ question_id: crypto.randomUUID(), strokes: [] }])).status()).toBe(422);
    expect((await bad([{ question_id: taking.questions[0].id, strokes: ['4 5000 10'] }])).status()).toBe(422);

    // Discarded: it stays listed, as discarded.
    const discarded = await unwrap<any>(
      await admin.request.post(`/api/canvas-assessments/${created.id}/discard`, { data: {} }),
      'discarding',
    );
    expect(discarded.status).toBe('discarded');
  });
});
