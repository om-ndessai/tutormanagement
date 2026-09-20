import { expect, test } from '../support/fixtures.js';

/** Phase 10: the session log and payment ledger as spreadsheets. */
test.describe('csv export', () => {
  test('an admin exports every session; a tutor only their own', async ({ as }) => {
    const admin = await as('admin');
    const tutor = await as('tutor');

    const adminCsv = await (await admin.request.get('/api/sessions/export.csv')).text();
    const tutorCsv = await (await tutor.request.get('/api/sessions/export.csv')).text();

    const rows = (csv: string) => csv.trim().split('\r\n').length - 1;

    expect(rows(adminCsv)).toBeGreaterThan(rows(tutorCsv));
    // The export can never widen what somebody may see.
    expect(tutorCsv).not.toContain('Priya Raghavan');
  });

  test('the file is shaped for a spreadsheet', async ({ as }) => {
    const admin = await as('admin');
    const response = await admin.request.get('/api/sessions/export.csv');

    expect(response.headers()['content-type']).toContain('text/csv');
    expect(response.headers()['content-disposition']).toMatch(/attachment; filename="tmi-sessions-/);

    const csv = await response.text();

    // A UTF-8 BOM, or Excel on Windows mangles non-ASCII names.
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('\r\n');
    expect(csv).toContain('Date,Student,Tutor,Start,End,Minutes,Mode');
    // Money is a bare decimal so the spreadsheet can sum it.
    expect(csv).toMatch(/,\d+\.\d{2},/);
  });

  test('a note that looks like a formula is exported as text', async ({ as }) => {
    const tutor = await as('tutor');

    const assignments = await (await tutor.request.get('/api/assignments')).json();
    const target = assignments.data[0];

    const created = await tutor.request.post('/api/sessions', {
      data: {
        tutor_user_id: target.tutor_user_id,
        student_user_id: target.student_user_id,
        occurred_on: '2026-09-22',
        started_at: '09:00',
        ended_at: '10:00',
        mode: 'in_person',
        notes: '=1+1',
      },
    });

    const csv = await (await tutor.request.get('/api/sessions/export.csv')).text();
    // Prefixed with an apostrophe so Excel and Sheets read it as text rather
    // than evaluating it in whoever opens the file.
    expect(csv).toContain("'=1+1");

    await tutor.request.delete(`/api/sessions/${(await created.json()).data.id}`);
  });

  test('payments export carries direction and form', async ({ as }) => {
    const admin = await as('admin');
    const csv = await (await admin.request.get('/api/payments/export.csv')).text();

    expect(csv).toContain('Date,Direction,Person,For student,Form,Amount (USD)');
    expect(csv).toMatch(/Received from parent|Paid to tutor/);
  });
});
