import type { Page } from '@playwright/test';
import { PRIVACY_VERSION, TERMS_VERSION, asksForPercent, checkAnswer } from '@tmi/shared';
import { expect, ORGS, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 72 (docs/journey-fixes-plan.md): codes and the spaces menu, the contract half.
 * - JF26: a request to join carries the role asked for and a note, for the space's admins only (R32);
 * - JF9: a game code from another space is refused honestly, revealing nothing;
 * - JF33: each new space takes the next palette; a personal space stays slate and is "Just you";
 * - JF12: an invitation names who invited; someone a space added accepts the terms once, at first sign-in;
 * - JF10: a trailing % counts only where the question asks for a percent.
 *
 * Serial: requests made and withdrawn, spaces made.
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
const session = async (page: Page) => unwrap<any>(await page.request.get('/api/auth/session'), 'the session');

test.describe('Phase 72', () => {
  test('JF26: a request says the role asked for and a note, and the Let in sheet starts on it', async ({ as }) => {
    const sofia = await as('student');
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    try {
      await sofia.goto('/spaces');
      await sofia.getByTestId('welcome-code').fill('FMXY-2345');
      await sofia.getByTestId('welcome-find').click();
      await expect(sofia.getByTestId('welcome-found')).toContainText('Ferreira Family Practice');
      // Anyone but a teen may ask as a parent, a learner or a helper; the space has no Tutoring, so no tutor.
      await expect(sofia.getByTestId('join-ask-role-parent')).toBeChecked();
      await expect(sofia.getByTestId('join-ask-role-tutor')).toHaveCount(0);
      await sofia.getByTestId('join-ask-role-admin').check();
      await sofia.getByTestId('join-ask-note').fill('I help my sister with her practice.');
      await sofia.getByTestId('welcome-ask').click();
      await expect(sofia.getByText('Asked to join Ferreira Family Practice. Its admins will let you in.')).toBeVisible();

      // The space's admins read both; the log says only that they asked.
      const requests = await unwrap<any[]>(await ines.request.get('/api/organization/join-requests'), 'requests');
      const mine = requests.find((r) => r.full_name === 'Sofia Okafor');
      expect(mine).toMatchObject({ role: 'admin', note: 'I help my sister with her practice.' });
      const audit = await unwrap<any[]>(await ines.request.get('/api/audit?limit=20'), 'the log');
      expect(JSON.stringify(audit)).not.toContain('my sister');

      await ines.goto('/users');
      await expect(ines.getByTestId(`join-request-note-${mine.user_id}`).filter({ visible: true }).first()).toContainText('I help my sister');
      await ines.getByTestId(`join-request-let-in-${mine.user_id}`).filter({ visible: true }).first().click();
      await expect(ines.getByTestId('let-in-asked')).toContainText('Asked as helping run it');
      await expect(ines.getByTestId('let-in-role-admin')).toBeChecked();
      await ines.keyboard.press('Escape');
    } finally {
      await sofia.request.delete('/api/spaces/join-requests/assess');
    }

    // A teen asks only as a learner: anything else is refused, and nothing is stored.
    const theo = await as('admin', { email: 'theo.teen@example.com', org: null });
    const refused = await theo.request.post('/api/spaces/join-requests', { data: { code: 'FMXY2345', role: 'parent' } });
    expect(refused.status()).toBe(422);
    expect((await refused.json()).error.details.role).toBeTruthy();
    // A note that carries an SSN is refused like every free-text field.
    const ssn = await sofia.request.post('/api/spaces/join-requests', { data: { code: 'FMXY2345', note: 'my SSN is 123-45-6789' } });
    expect(ssn.status()).toBe(422);
  });

  test("JF9: another space's game code is refused in the same words as no game at all", async ({ as }) => {
    const admin = await as('admin');
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    expect((await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    expect((await rosa.request.patch('/api/organization/settings', { data: { gamify_question_quest: true } })).status()).toBe(200);
    try {
      const game = await unwrap<any>(
        await admin.request.post('/api/quest/games', {
          data: { level_id: 'NC26.5', mode: 'count', question_count: 3, players: 'multi', max_team_size: 1 },
        }),
        'a game in the institute',
      );
      const elsewhere = await rosa.request.post('/api/quest/games/lookup', { data: { code: game.code } });
      const nowhere = await rosa.request.post('/api/quest/games/lookup', { data: { code: 'ZZZZZZ' } });
      expect(elsewhere.status()).toBe(404);
      expect(nowhere.status()).toBe(404);
      const words = (await elsewhere.json()).error.message;
      expect(words).toBe((await nowhere.json()).error.message);
      // Phase 78 (JF32): a quest, in the glossary's word.
      expect(words).toContain('ask your friend to invite you there, or start your own quest');
    } finally {
      await admin.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
      await rosa.request.patch('/api/organization/settings', { data: { gamify_question_quest: false } });
    }
  });

  test('JF33: each new space takes the next palette; a personal space is slate and "Just you"', async ({ page, as }) => {
    const email = `p72.maker.${run}@example.com`;
    await unwrap(
      await page.request.post('/api/auth/signup', {
        data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, birth_month: 6, birth_year: 1985, dev_email: email, dev_name: 'Mara Maker' },
      }),
      'signs up',
    );
    const mara = await as('admin', { email, org: null });
    const first = await unwrap<any>(await mara.request.post('/api/spaces', { data: { name: `Mara Club ${run}` } }), 'first space');
    const second = await unwrap<any>(await mara.request.post('/api/spaces', { data: { name: `Mara Choir ${run}` } }), 'second space');
    const now = await session(mara);
    const paletteOf = (slug: string) => now.memberships.find((m: any) => m.slug === slug)?.palette;
    expect([paletteOf(first.slug), paletteOf(second.slug)]).toEqual(['indigo', 'teal']);
    const personal = now.memberships.find((m: any) => m.personal);
    expect(personal).toMatchObject({ palette: 'platform' });
    expect(now.memberships.filter((m: any) => m.personal)).toHaveLength(1);

    await mara.goto('/');
    await mara.getByTestId('org-switcher').filter({ visible: true }).first().click();
    await expect(mara.getByRole('menuitem', { name: new RegExp(personal.name) })).toContainText('Just you');
  });

  test('JF12: the invitation names who invited; someone a space added accepts the terms once, at first sign-in', async ({ as }) => {
    const email = `p72.invited.${run}@example.com`;
    const ines = await as('assessAdmin', { org: ORGS.c.slug });
    await unwrap(
      await ines.request.post('/api/users', { data: { full_name: `Pia Invited ${run}`, email, roles: ['parent'], status: 'invited' } }),
      'Ines invites Pia',
    );
    const pia = await as('parent', { email, org: null });
    const before = await session(pia);
    expect(before.invitations).toEqual([expect.objectContaining({ slug: ORGS.c.slug, invited_by_first_name: 'Ines' })]);
    expect(before.legal_due).toBe(false);

    // Her first sign-in: the terms are due, and the portal waits behind them.
    await unwrap(
      await pia.request.post('/api/auth/google', { data: { credential: `fake:google:p72-${run}:${email}:1` } }),
      'first sign-in',
    );
    expect((await session(pia)).legal_due).toBe(true);
    await pia.goto('/spaces');
    const sheet = pia.getByTestId('legal-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('legal-accept')).toBeDisabled();
    await sheet.getByTestId('legal-agree').check();
    await sheet.getByTestId('legal-accept').click();
    await expect(sheet).toHaveCount(0);
    expect((await session(pia)).legal_due).toBe(false);
    // The invitation is still hers to answer, and names Ines.
    await expect(pia.getByTestId(`invitation-${ORGS.c.slug}`)).toContainText('Invited as Parent by Ines');

    // Once: a later sign-in asks nothing more.
    await unwrap(
      await pia.request.post('/api/auth/google', { data: { credential: `fake:google:p72-${run}:${email}:1` } }),
      'second sign-in',
    );
    expect((await session(pia)).legal_due).toBe(false);
    // Nothing was due, so a second accept changes nothing (and is no error).
    await unwrap(
      await pia.request.post('/api/auth/legal', { data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } }),
      'again',
    );
    // A version nobody publishes is refused.
    expect((await pia.request.post('/api/auth/legal', { data: { terms_version: '1999-01-01', privacy_version: PRIVACY_VERSION } })).status()).toBe(422);
  });

  test('JF10: a trailing % counts only where the question asks for a percent', () => {
    const percent = { kind: 'numeric' as const, answer: '30', stem: 'Of 40 students, 12 walk. What percent of the students walk?' };
    expect(asksForPercent(percent.stem)).toBe(true);
    expect(checkAnswer(percent, '30%')).toBe(true);
    expect(checkAnswer(percent, '30 %')).toBe(true);
    expect(checkAnswer(percent, '30 percent')).toBe(true);
    expect(checkAnswer(percent, '30')).toBe(true);
    // Without the stem, as an older caller sends it: unchanged.
    expect(checkAnswer({ kind: 'numeric', answer: '30' }, '30%')).toBe(false);
    // A percent given, a count asked: no.
    const given = { kind: 'numeric' as const, answer: '10', stem: 'How many dollars of interest does a deposit of 100 dollars earn in 2 years at 5 percent per year?' };
    expect(asksForPercent(given.stem)).toBe(false);
    expect(checkAnswer(given, '10%')).toBe(false);
    expect(asksForPercent('What is 50% of 80?')).toBe(false);
    expect(asksForPercent('By how many percentage points did it rise?')).toBe(true);
    expect(asksForPercent('A survey of 200 people. Write just the number, without the % sign.')).toBe(true);
  });
});
