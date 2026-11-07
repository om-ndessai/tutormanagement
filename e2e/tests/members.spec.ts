import type { APIResponse, Page } from '@playwright/test';
import {
  EMAIL_REQUIRED_MESSAGE,
  PRIVACY_VERSION,
  TEEN_ADMIN_MESSAGE,
  TERMS_VERSION,
  inviteRowRequest,
  nameFromEmail,
} from '@tmi/shared';

import { expect, test } from '../support/fixtures.js';
import { idOf, personalSpaceOf, unwrap } from '../support/api.js';

/**
 * Phase 79 (docs/members-plan.md, M1-M8), through the API: a MEMBER is in a space with no role. They are added with
 * just an email (M3), hold no role until an admin gives one under that role's rules (M2, M7), play Quest only -- no
 * Question Quest, no assessment of their own in a shared space, no dashboard (M6) -- and keep their own name once they
 * sign in (M4). A space keeps an active admin (`last_admin`, M2), and a 13-17 who signed themselves up is never an
 * admin of a shared space (M5).
 *
 * Everyone and every self-serve space here is made fresh, so nothing seeded changes and a rerun on the same database
 * meets nobody it made before. With sign-in off, `dev_email` stands in for the provider at sign-up, and the suite's
 * fake provider tokens (AUTH_FAKE_PROVIDERS, local only) for a first sign-in.
 */
test.describe.configure({ mode: 'serial' });

const run = Date.now().toString(36);
let counter = 0;
const fresh = (label: string) => `m79.${label}.${run}.${++counter}@example.com`;

const signup = async (page: Page, email: string, name: string, birthYear = 1984) =>
  unwrap(
    await page.request.post('/api/auth/signup', {
      data: {
        dev_email: email,
        dev_name: name,
        birth_year: birthYear,
        birth_month: 6,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    }),
    `signing up ${email}`,
  );

const teenYear = () => new Date().getFullYear() - 15;

/** An adult signs up and starts a self-serve space; the page returned is them, in it. */
async function startSpace(as: any, page: Page, label: string) {
  const email = fresh(label);
  const name = `${label.charAt(0).toUpperCase()}${label.slice(1)} Maker`;
  await signup(page, email, name);
  const outside: Page = await as('admin', { email, org: null });
  const space = `The ${label} circle ${run}`;
  const made = await unwrap<any>(await outside.request.post('/api/spaces', { data: { name: space } }), `starting ${space}`);
  const inside: Page = await as('admin', { email, org: made.slug });
  return { email, name, space, slug: made.slug as string, outside, inside };
}

async function refusedAs(response: APIResponse, status: number, code: string) {
  expect(response.status()).toBe(status);
  const { error } = (await response.json()) as { error: { code: string; message: string; details?: Record<string, string[]> } };
  expect(error.code).toBe(code);
  return error;
}

/** The space's log about one person, newest first, as its admin reads it. */
const logAbout = async (admin: Page, userId: string) =>
  unwrap<any[]>(await admin.request.get(`/api/audit?user_id=${userId}&limit=50`), 'the log about them');

test.describe('Phase 79: members (API)', () => {
  test('M1-M2: a member is added with an email and no role, found by the Members filter, and given roles later', async ({ as }) => {
    const admin = await as('admin');

    // Signing in needs an address, so a member needs one too.
    const without = await admin.request.post('/api/users', { data: { full_name: 'Nell Noaddress', roles: [], status: 'active' } });
    const refusal = await refusedAs(without, 422, 'validation_failed');
    expect(refusal.details?.email).toEqual([EMAIL_REQUIRED_MESSAGE]);

    const email = fresh('member');
    const name = `Mila Member ${run}`;
    const member = await unwrap<any>(
      await admin.request.post('/api/users', { data: { full_name: name, email, roles: [], status: 'active' } }),
      'adding a member',
    );
    try {
      expect(member.roles).toEqual([]);
      expect((await logAbout(admin, member.id)).map((e) => e.description)).toContain(`Added ${name} as a member`);

      // The Members filter: nobody holding a role, and the member is in no role's list.
      const members = await unwrap<any[]>(await admin.request.get('/api/users?role=member&limit=100'), 'the members');
      expect(members.map((p) => p.id)).toContain(member.id);
      expect(members.every((p) => p.roles.length === 0)).toBe(true);
      const parents = await unwrap<any[]>(await admin.request.get(`/api/users?role=parent&search=${encodeURIComponent(email)}`), 'parents');
      expect(parents).toEqual([]);

      // Roles later, under today's rules (M7): a student needs a parent here; a parent is saved.
      const student = await refusedAs(
        await admin.request.patch(`/api/users/${member.id}`, { data: { roles: ['student'] } }),
        422,
        'validation_failed',
      );
      expect(student.details?.guardians).toBeTruthy();
      const parent = await unwrap<any>(await admin.request.patch(`/api/users/${member.id}`, { data: { roles: ['parent'] } }), 'a parent');
      expect(parent.roles).toEqual(['parent']);

      // And back to a member: the line says so; a non-empty change reads as it always has.
      const again = await unwrap<any>(await admin.request.patch(`/api/users/${member.id}`, { data: { roles: [] } }), 'a member again');
      expect(again.roles).toEqual([]);
      const lines = (await logAbout(admin, member.id)).map((e) => e.description);
      expect(lines).toContain(`Changed ${name}'s roles to parent`);
      expect(lines).toContain(`Made ${name} a member, with no role`);

      // What a member sees: no dashboard (kept for deep links, in words), and no assessment-led home.
      const mila = await as('student', { email });
      const dashboard = await refusedAs(await mila.request.get('/api/dashboard'), 409, 'conflict');
      expect(dashboard.message).toBe(`${name} is a member here, so there is no dashboard to show.`);
      const home = await unwrap<any>(await mila.request.get('/api/home'), 'her home');
      expect(home.may_assess).toBe(false);
      expect(home.focus).not.toBe('assessment');
      expect(home.focus_options).not.toContain('assessment');
    } finally {
      await admin.request.delete(`/api/users/${member.id}?hard=true`);
    }
  });

  test('M2: the last active admin is kept -- refused on dropping the role and on suspending, themselves included', async ({
    as,
    page,
  }) => {
    const maker = await startSpace(as, page, 'keeper');
    const lastAdmin = (space: string) => `You are ${space}'s only administrator. Make someone else an administrator first.`;

    // Their own personal space, made at sign-up: its only admin.
    const own = await personalSpaceOf(maker.outside);
    const inOwn: Page = await as('admin', { email: maker.email, org: own.slug });
    const meThere = await idOf(inOwn, maker.email);
    for (const data of [{ roles: [] }, { status: 'suspended' }]) {
      const error = await refusedAs(await inOwn.request.patch(`/api/users/${meThere}`, { data }), 409, 'last_admin');
      expect(error.message).toBe(lastAdmin(own.name));
    }

    // The space they started: the same, until someone else is an admin there too.
    const me = await idOf(maker.inside, maker.email);
    for (const data of [{ roles: [] }, { status: 'suspended' }, { roles: ['parent'] }]) {
      const error = await refusedAs(await maker.inside.request.patch(`/api/users/${me}`, { data }), 409, 'last_admin');
      expect(error.message).toBe(lastAdmin(maker.space));
    }
    // Keeping the role is no problem.
    expect((await unwrap<any>(await maker.inside.request.patch(`/api/users/${me}`, { data: { roles: ['admin', 'parent'] } }), 'parent too')).roles).toEqual([
      'admin',
      'parent',
    ]);

    const coEmail = fresh('co-admin');
    const coName = `Cora Coadmin ${run}`;
    await unwrap(
      await maker.inside.request.post('/api/users', { data: { full_name: coName, email: coEmail, roles: ['admin'], status: 'active' } }),
      'a second admin',
    );
    const stepsDown = await unwrap<any>(await maker.inside.request.patch(`/api/users/${me}`, { data: { roles: [] } }), 'steps down');
    expect(stepsDown.roles).toEqual([]);
    const cora: Page = await as('admin', { email: coEmail, org: maker.slug });
    expect((await logAbout(cora, me)).map((e) => e.description)).toContain(`Made ${maker.name} a member, with no role`);

    // Now Cora is the one.
    const coraId = await idOf(cora, coEmail);
    for (const data of [{ roles: ['parent'] }, { status: 'suspended' }]) {
      const error = await refusedAs(await cora.request.patch(`/api/users/${coraId}`, { data }), 409, 'last_admin');
      expect(error.message).toBe(lastAdmin(maker.space));
    }
  });

  test('M5: a teen is let in as a member, never as an admin, and joins an admin invitation without the role', async ({ as, page }) => {
    const host = await startSpace(as, page, 'host');
    const code = await unwrap<any>(await host.inside.request.get('/api/organization/code'), 'the code');
    expect(code.join_by_code).toBe(true);

    // A teen and an adult ask to join.
    const teenEmail = fresh('teen');
    const teenName = `Tess Teen ${run}`;
    await signup(page, teenEmail, teenName, teenYear());
    const tess: Page = await as('student', { email: teenEmail, org: null });
    await unwrap(await tess.request.post('/api/spaces/join-requests', { data: { code: code.code } }), 'the teen asks');
    const adultEmail = fresh('adult');
    await signup(page, adultEmail, `Ari Adult ${run}`);
    await unwrap(
      await (await as('admin', { email: adultEmail, org: null })).request.post('/api/spaces/join-requests', { data: { code: code.code } }),
      'the adult asks',
    );

    // The admins read which request is a teen's (R32), beside the request.
    const requests = await unwrap<any[]>(await host.inside.request.get('/api/organization/join-requests'), 'requests');
    const teenRequest = requests.find((r) => r.email === teenEmail);
    const adultRequest = requests.find((r) => r.email === adultEmail);
    expect(teenRequest).toMatchObject({ teen: true });
    expect(adultRequest).toMatchObject({ teen: false });

    // Let in as an admin: refused, in words. As a member: in.
    const letIn = (request: any, roles: string[]) =>
      host.inside.request.post('/api/users', {
        data: { full_name: request.full_name, email: request.email, roles, status: 'active', join_request_user_id: request.user_id },
      });
    const asAdmin = await refusedAs(await letIn(teenRequest, ['admin']), 422, 'validation_failed');
    expect(asAdmin.details?.roles).toEqual([TEEN_ADMIN_MESSAGE]);
    const tessIn = await unwrap<any>(await letIn(teenRequest, []), 'the teen let in as a member');
    expect(tessIn.roles).toEqual([]);
    expect((await logAbout(host.inside, tessIn.id)).map((e) => e.description)).toContain(`Let ${teenName} in as a member`);
    // An adult may be let in as an admin.
    expect((await unwrap<any>(await letIn(adultRequest, ['admin']), 'the adult let in as an admin')).roles).toEqual(['admin']);

    // Later, an admin cannot make her one either.
    const later = await refusedAs(
      await host.inside.request.patch(`/api/users/${tessIn.id}`, { data: { roles: ['admin'] } }),
      422,
      'validation_failed',
    );
    expect(later.details?.roles).toEqual([TEEN_ADMIN_MESSAGE]);

    // What she may do there: play Quest, not Question Quest; no assessment of her own in a shared space.
    const tessHere: Page = await as('student', { email: teenEmail, org: host.slug });
    const quest = await refusedAs(await tessHere.request.get('/api/quest/me'), 403, 'forbidden');
    expect(quest.message).toBe('Question Quest is for students.');
    expect((await tessHere.request.get('/api/quest/tiles')).status()).toBe(200);
    expect(
      (await tessHere.request.post('/api/canvas-assessments', { data: { student_user_id: tessIn.id, level_id: 'NC26.4' } })).status(),
    ).toBe(404);
    const home = await unwrap<any>(await tessHere.request.get('/api/home'), 'her home');
    expect(home.may_assess).toBe(false);
    expect(home.focus_options).not.toContain('assessment');

    // A second teen, invited by email as an admin: the invitation is made as for anyone (a refusal would say the
    // address has an account, R21), and accepting it joins her without the role -- the log says so.
    const tobiEmail = fresh('teen-invited');
    const tobiName = `Tobi Teen ${run}`;
    await signup(page, tobiEmail, tobiName, teenYear());
    const invited = await unwrap<any>(
      await host.inside.request.post('/api/users', { data: { full_name: 'Tobi', email: tobiEmail, roles: ['admin'], status: 'invited' } }),
      'inviting her as an admin',
    );
    expect(invited).toMatchObject({ status: 'invited', roles: ['admin'] });
    const tobi: Page = await as('student', { email: tobiEmail, org: null });
    const accepted = await unwrap<any>(await tobi.request.post(`/api/auth/invitations/${host.slug}/accept`), 'she accepts');
    expect(accepted.memberships.find((m: any) => m.slug === host.slug)).toMatchObject({ roles: [] });
    expect((await logAbout(host.inside, invited.id)).map((e) => e.description)).toContain(
      `${tobiName} accepted the invitation to ${host.space}, without the admin role: someone 13 to 17 is not an admin of a shared space`,
    );
  });

  test('M3-M4: an invitation by email alone keeps its name until accepted, then the person’s own from their provider', async ({
    as,
    page,
  }) => {
    const host = await startSpace(as, page, 'namer');

    // "Anyone, by email": the row a client sends, a member's (no role), the name made from the address.
    const rubyEmail = fresh('ruby.rivers');
    const derived = nameFromEmail(rubyEmail);
    const ruby = await unwrap<any>(
      await host.inside.request.post('/api/users', { data: inviteRowRequest({ email: rubyEmail, role: 'member' }) }),
      'inviting by email alone',
    );
    expect(ruby).toMatchObject({ status: 'invited', roles: [], full_name: derived });
    expect((await logAbout(host.inside, ruby.id)).map((e) => e.description)).toContain(`Invited ${derived} as a member`);
    // One with a name typed keeps it.
    const tomasEmail = fresh('tomas');
    const tomas = await unwrap<any>(
      await host.inside.request.post('/api/users', {
        data: inviteRowRequest({ email: tomasEmail, full_name: 'Tomas Typed', role: 'member' }),
      }),
      'inviting with a name',
    );

    // Her first sign-in: her provider's name becomes hers ...
    const rubyPage: Page = await as('student', { email: rubyEmail, org: null });
    const signedIn = await unwrap<any>(
      await rubyPage.request.post('/api/auth/google', { data: { credential: `fake:google:m79-ruby-${run}:${rubyEmail}:1:Ruby Q Rivers` } }),
      'her first sign-in',
    );
    expect(signedIn.user.full_name).toBe('Ruby Q Rivers');
    await rubyPage.request.post('/api/auth/legal', { data: { terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION } });
    // ... but the space reads the name it invited until she accepts (R21).
    const before = (await unwrap<any[]>(await host.inside.request.get('/api/users'), 'people')).find((p) => p.id === ruby.id);
    expect(before).toMatchObject({ status: 'invited', full_name: derived });

    await unwrap(await rubyPage.request.post(`/api/auth/invitations/${host.slug}/accept`), 'she accepts');
    const after = (await unwrap<any[]>(await host.inside.request.get('/api/users'), 'people after')).find((p) => p.id === ruby.id);
    expect(after).toMatchObject({ status: 'active', roles: [], full_name: 'Ruby Q Rivers' });

    // Only the first sign-in, and only a name made from the address: a later one changes nothing ...
    const later = await unwrap<any>(
      await rubyPage.request.post('/api/auth/google', { data: { credential: `fake:google:m79-ruby-${run}:${rubyEmail}:1:R. Rivers` } }),
      'a later sign-in',
    );
    expect(later.user.full_name).toBe('Ruby Q Rivers');
    // ... and a name the space typed is kept.
    const tomasPage: Page = await as('student', { email: tomasEmail, org: null });
    const tomasIn = await unwrap<any>(
      await tomasPage.request.post('/api/auth/google', { data: { credential: `fake:google:m79-tomas-${run}:${tomasEmail}:1:Tom Provider` } }),
      'his first sign-in',
    );
    expect(tomasIn.user.full_name).toBe('Tomas Typed');
    expect(tomas.full_name).toBe('Tomas Typed');
  });
});
