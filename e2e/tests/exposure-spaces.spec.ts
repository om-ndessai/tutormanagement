import { test, expect, ORGS, PEOPLE } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';
import { visible } from '../support/ui.js';
import { PRIVACY_VERSION, TERMS_VERSION, decideLanding, inviteRowRequest } from '@tmi/shared';

/**
 * R21 (Phase 52, docs/data-exposure.md): a space's code reaches only its admins; a lookup gives its
 * public face alone, and only while joining by code is on; a request reaches the person who made it
 * and that space's admins; a newcomer with no space reads nothing of any space.
 */

const SPACE_READS = ['/api/users', '/api/audit', '/api/organization/settings', '/api/organization/code', '/api/organization/join-requests', '/api/canvas-assessments'];

const S13_STAMP = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Exactly what a space's face is on the person's own lists (`toBrand`), and nothing more. */
const BRAND_KEYS = ['blurb', 'builtin_logo', 'id', 'logo_full_url', 'logo_mark_url', 'name', 'palette', 'place', 'short_name', 'slug', 'tagline'];
const MEMBERSHIP_KEYS = [...BRAND_KEYS, 'is_default', 'roles', 'status'].sort();
const INVITATION_KEYS = [...BRAND_KEYS, 'invited_at', 'roles'].sort();
const JOIN_REQUEST_KEYS = ['logo_mark_url', 'name', 'outcome', 'palette', 'requested_at', 'short_name', 'slug'];

async function s13SignUp(page: import('@playwright/test').Page, email: string, name: string) {
  await unwrap(
    await page.request.post('/api/auth/signup', {
      data: {
        dev_email: email,
        dev_name: name,
        birth_year: 1980,
        birth_month: 6,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      },
    }),
    `signing up ${email}`,
  );
}

const s13Session = async (page: import('@playwright/test').Page, slug?: string) =>
  unwrap<any>(
    await page.request.get('/api/auth/session', slug ? { headers: { 'X-Organization': slug } } : undefined),
    'the session',
  );

/** The parts of the session the Spaces page and the banner render. */
const ownLists = (s: any) => ({ memberships: s.memberships, invitations: s.invitations, join_requests: s.join_requests });

test.describe('spaces: who sees what (R21)', () => {
  test('a newcomer with no space reads nothing of any space', async ({ page, as }) => {
    // A newcomer of the test's own: the seed's (Nina) is let into a space by spaces.spec.ts.
    const newcomer = `newcomer.r21.${S13_STAMP}@example.com`;
    await s13SignUp(page, newcomer, 'Nadia Newcomer');
    for (const org of [ORGS.a.slug, ORGS.b.slug, ORGS.c.slug]) {
      const nina = await as('admin', { email: newcomer, org });
      for (const path of SPACE_READS) {
        const response = await nina.request.get(path);
        expect(response.status(), `${org} ${path}`).toBe(403);
        expect((await response.json()).error.code).toBe('organization_required');
      }
    }
  });

  test('a lookup shows the face, never the people; the code and requests are the admins’ alone', async ({ page, as }) => {
    // A space and a code of the test's own: other specs change the seed's (assess's FMXY-2345).
    const maker = `maker.r21.${S13_STAMP}@example.com`;
    const asker = `asker.r21.${S13_STAMP}@example.com`;
    await s13SignUp(page, maker, 'Mira Maker');
    await s13SignUp(page, asker, 'Abel Asker');
    const makerHome = await as('admin', { email: maker, org: null });
    const space = await unwrap<any>(await makerHome.request.post('/api/spaces', { data: { name: `Mira Room ${S13_STAMP}` } }), 'the space');
    const makerIn = await as('admin', { email: maker, org: space.slug });
    const own = await unwrap<any>(await makerIn.request.get('/api/organization/code'), 'its code');
    expect(own.join_by_code).toBe(true);
    const theo = await as('admin', { email: asker, org: null });
    const found = await unwrap<Record<string, unknown>>(await theo.request.post('/api/spaces/lookup', { data: { code: own.code } }), 'lookup');
    expect(Object.keys(found).sort()).toEqual(['logo_mark_url', 'name', 'palette', 'short_name', 'standing']);

    // Omar, a parent in the space, is not one of its admins.
    const omar = await as('assessParent', { org: ORGS.c.slug });
    expect((await omar.request.get('/api/organization/code')).status()).toBe(403);
    expect((await omar.request.get('/api/organization/join-requests')).status()).toBe(403);
    // An institute admin is nobody in another space (R13).
    const priya = await as('admin');
    const theirs = await unwrap<any[]>(await priya.request.get('/api/organization/join-requests'), 'institute requests');
    expect(theirs.some((r) => r.full_name === 'Theo Teen')).toBe(false);
    const code = await unwrap<any>(await priya.request.get('/api/organization/code'), 'institute code');
    expect(code).toEqual({ code: 'CHMX-2345', join_by_code: false });
    // Riverside's admin sees Riverside's requests -- Theo's -- and only the face Google gave.
    const rosa = await as('orgBAdmin', { org: ORGS.b.slug });
    const requests = await unwrap<any[]>(await rosa.request.get('/api/organization/join-requests'), 'riverside requests');
    for (const r of requests) expect(Object.keys(r).sort()).toEqual(['email', 'full_name', 'requested_at', 'user_id']);
  });
});

/**
 * S13 (Phase 61, docs/spaces-plan.md; R21 extended, docs/data-exposure.md): the Spaces page and the
 * invitation banner read only `GET /api/auth/session` -- the person's own memberships, invitations
 * and requests; leaving a space reveals nothing about it; and an invitation still shows the
 * inviting space only the name it typed. Each test makes its own people and spaces (signed up with
 * `dev_email`, sign-in being off locally), so the order of runs does not matter.
 */

test.describe('spaces page, banner and leaving: who sees what (S13)', () => {
  test('every seeded persona’s session lists only their own spaces, invitations and requests', async ({ as }) => {
    const everyone = Object.values(PEOPLE).map((p) => p.email.toLowerCase());
    for (const [key, person] of Object.entries(PEOPLE)) {
      const page = await as(key as keyof typeof PEOPLE, { org: null });
      const session = await s13Session(page);
      expect(session.user.email?.toLowerCase(), key).toBe(person.email.toLowerCase());

      for (const m of session.memberships) expect(Object.keys(m).sort(), `${key} membership`).toEqual(MEMBERSHIP_KEYS);
      for (const i of session.invitations) expect(Object.keys(i).sort(), `${key} invitation`).toEqual(INVITATION_KEYS);
      for (const r of session.join_requests) expect(Object.keys(r).sort(), `${key} request`).toEqual(JOIN_REQUEST_KEYS);

      // No other person's address anywhere in what the page renders.
      const text = JSON.stringify(ownLists(session)).toLowerCase();
      for (const other of everyone) if (other !== person.email.toLowerCase()) expect(text, `${key} reads ${other}`).not.toContain(other);

      // A space is listed as theirs only where they are a member, and invited only where they are not yet one.
      const memberSlugs = new Set<string>(session.memberships.map((m: any) => m.slug));
      for (const invite of session.invitations) expect(memberSlugs.has(invite.slug), `${key} ${invite.slug}`).toBe(false);
      for (const m of session.memberships.filter((row: any) => row.status === 'active')) {
        const inside = await s13Session(page, m.slug);
        expect(inside.organization?.slug, `${key} enters ${m.slug}`).toBe(m.slug);
      }
      for (const invite of session.invitations) {
        const refused = await page.request.get('/api/users', { headers: { 'X-Organization': invite.slug } });
        expect(refused.status(), `${key} inside ${invite.slug} before accepting`).toBe(403);
      }
      for (const request of session.join_requests) {
        expect(memberSlugs.has(request.slug), `${key} asked to join ${request.slug}`).toBe(false);
      }
    }
  });

  test('a member, an invitee and someone who asked each read only their own lists; the banner and the page show only those', async ({ page, as }) => {
    const ada = { email: `ada.s13.${S13_STAMP}@example.com`, name: 'Ada Sthirteen' };
    const ben = { email: `ben.s13.${S13_STAMP}@example.com`, name: 'Ben Ownname' };
    const cara = { email: `cara.s13.${S13_STAMP}@example.com`, name: 'Cara Asker' };
    await s13SignUp(page, ada.email, ada.name);
    await s13SignUp(page, ben.email, ben.name);
    await s13SignUp(page, cara.email, cara.name);

    const adaHome = await as('admin', { email: ada.email, org: null });
    const benHome = await as('admin', { email: ben.email, org: null });
    const caraHome = await as('admin', { email: cara.email, org: null });
    const spaceA = await unwrap<any>(await adaHome.request.post('/api/spaces', { data: { name: `Ada Circle ${S13_STAMP}` } }), 'Ada makes a space');
    const spaceB = await unwrap<any>(await benHome.request.post('/api/spaces', { data: { name: `Ben Circle ${S13_STAMP}` } }), 'Ben makes a space');

    // Ada invites Ben (who has a space of his own) under a name she typed.
    const adaIn = await as('admin', { email: ada.email, org: spaceA.slug });
    const invited = await unwrap<any>(
      await adaIn.request.post('/api/users', { data: { full_name: 'Typed by Ada', email: ben.email, roles: ['parent'], status: 'active' } }),
      'Ada invites Ben',
    );
    expect(invited.status).toBe('invited');

    // Cara asks to join Ben's space with its code.
    const benIn = await as('admin', { email: ben.email, org: spaceB.slug });
    const code = await unwrap<any>(await benIn.request.get('/api/organization/code'), 'Ben’s code');
    expect(code.join_by_code).toBe(true);
    await unwrap(await caraHome.request.post('/api/spaces/join-requests', { data: { code: code.code } }), 'Cara asks');

    const adaS = await s13Session(adaHome);
    const benS = await s13Session(benHome);
    const caraS = await s13Session(caraHome);

    expect(adaS.memberships.map((m: any) => m.slug)).toEqual([spaceA.slug]);
    expect(adaS.invitations).toEqual([]);
    expect(adaS.join_requests).toEqual([]);

    expect(benS.memberships.map((m: any) => m.slug)).toEqual([spaceB.slug]);
    expect(benS.invitations.map((i: any) => i.slug)).toEqual([spaceA.slug]);
    expect(Object.keys(benS.invitations[0]).sort()).toEqual(INVITATION_KEYS);
    expect(benS.invitations[0].roles).toEqual(['parent']);
    expect(benS.join_requests).toEqual([]);

    expect(caraS.memberships).toEqual([]);
    expect(caraS.invitations).toEqual([]);
    expect(caraS.join_requests.map((r: any) => r.slug)).toEqual([spaceB.slug]);
    expect(Object.keys(caraS.join_requests[0]).sort()).toEqual(JOIN_REQUEST_KEYS);

    // Nobody's lists name anybody else: not the inviter to the invitee, not the asker to anyone.
    const people = [ada, ben, cara];
    for (const [reader, s] of [[ada, adaS], [ben, benS], [cara, caraS]] as const) {
      const text = JSON.stringify(ownLists(s)).toLowerCase();
      for (const other of people) {
        if (other === reader) continue;
        expect(text, `${reader.name} reads ${other.email}`).not.toContain(other.email);
        expect(text, `${reader.name} reads ${other.name}`).not.toContain(other.name.toLowerCase());
      }
      expect(text).not.toContain('typed by ada');
    }
    // The space's own session (inside it) reads the same own lists, nothing of the space's people.
    const benInside = await s13Session(benIn, spaceB.slug);
    expect(ownLists(benInside)).toEqual(ownLists(benS));
    expect(JSON.stringify(ownLists(benInside)).toLowerCase()).not.toContain(cara.email);

    // The banner: Ben, inside his own space, sees Ada's space invited him -- and nothing else.
    await benIn.goto('/');
    const banner = benIn.getByTestId('invitation-banner');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText(`Ada Circle ${S13_STAMP} invited you`);
    await expect(banner).not.toContainText('Typed by Ada');
    await expect(banner).not.toContainText(ada.name);
    // Ada, inside hers, has no invitation and no banner.
    await adaIn.goto('/');
    await expect(adaIn.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(adaIn.getByTestId('invitation-banner')).toHaveCount(0);

    // The Spaces page: Ben's space and Ada's invitation, and no row for anyone else's.
    await benIn.goto('/spaces');
    await expect(benIn.getByTestId('spaces-page')).toBeVisible();
    await expect(benIn.getByTestId(`org-${spaceB.slug}`)).toBeVisible();
    await expect(benIn.getByTestId(`invitation-${spaceA.slug}`)).toBeVisible();
    await expect(benIn.getByTestId(`org-${spaceA.slug}`)).toHaveCount(0);
    await expect(benIn.getByTestId('spaces-page')).not.toContainText(cara.name);
    await expect(benIn.getByTestId('spaces-page')).not.toContainText(ada.name);
    // Cara's page: her request, no space and no invitation.
    await caraHome.goto('/spaces');
    await expect(caraHome.getByTestId('spaces-page')).toBeVisible();
    await expect(caraHome.getByTestId(`org-${spaceB.slug}`)).toHaveCount(0);
    await expect(caraHome.getByTestId(`invitation-${spaceB.slug}`)).toHaveCount(0);
    await expect(caraHome.getByTestId('spaces-page')).not.toContainText(ben.name);
  });

  test('an invitation shows the inviting space only the name it typed, until it is accepted', async ({ page, as }) => {
    const host = { email: `host.s13.${S13_STAMP}@example.com`, name: 'Hollis Host' };
    const guest = { email: `guest.s13.${S13_STAMP}@example.com`, name: 'Gwendolyn Ownname' };
    await s13SignUp(page, host.email, host.name);
    await s13SignUp(page, guest.email, guest.name);
    const guestHome = await as('admin', { email: guest.email, org: null });
    // The guest exists elsewhere: a space of their own.
    await unwrap(await guestHome.request.post('/api/spaces', { data: { name: `Gwen Corner ${S13_STAMP}` } }), 'the guest’s own space');
    const hostHome = await as('admin', { email: host.email, org: null });
    const space = await unwrap<any>(await hostHome.request.post('/api/spaces', { data: { name: `Host Hall ${S13_STAMP}` } }), 'the host’s space');
    const hostIn = await as('admin', { email: host.email, org: space.slug });

    const invited = await unwrap<any>(
      await hostIn.request.post('/api/users', { data: { full_name: 'Guest (typed)', email: guest.email, roles: ['parent'], status: 'active' } }),
      'invite',
    );
    expect(invited).toMatchObject({ full_name: 'Guest (typed)', phone: null, status: 'invited' });
    const read = await unwrap<any>(await hostIn.request.get(`/api/users/${invited.id}`), 'reading the invitee');
    expect(read).toMatchObject({ full_name: 'Guest (typed)', phone: null });

    // A brand-new address invited the same way reads exactly alike: nothing in the answer -- the
    // lock on shared fields included -- says the guest's address already had an account elsewhere.
    const fresh = await unwrap<any>(
      await hostIn.request.post('/api/users', { data: { full_name: 'Newcomer (typed)', email: `fresh.s13.${S13_STAMP}@example.com`, roles: ['parent'], status: 'invited' } }),
      'invite a new address',
    );
    const freshRead = await unwrap<any>(await hostIn.request.get(`/api/users/${fresh.id}`), 'reading the new invitee');
    expect(invited.shared_fields_locked).toBe(fresh.shared_fields_locked);
    expect(read.shared_fields_locked).toBe(freshRead.shared_fields_locked);
    const VARY = new Set(['id', 'email', 'full_name', 'created_at', 'updated_at', 'invited_at', 'last_login_at', 'last_entered_at']);
    const shape = (u: any) => Object.fromEntries(Object.entries(u).filter(([k]) => !VARY.has(k)));
    expect(Object.keys(invited).sort()).toEqual(Object.keys(fresh).sort());
    expect(shape(invited)).toEqual(shape(fresh));
    expect(Object.keys(read).sort()).toEqual(Object.keys(freshRead).sort());
    expect(shape(read)).toEqual(shape(freshRead));
    const listed = await unwrap<any[]>(await hostIn.request.get(`/api/users?search=${encodeURIComponent(guest.email)}`), 'listed');
    expect(listed.map((u) => u.full_name)).toEqual(['Guest (typed)']);
    expect(JSON.stringify(listed)).not.toContain(guest.name);
    // On the People page too: the typed name, never their own.
    await hostIn.goto('/users');
    await expect(visible(hostIn, 'Guest (typed)').first()).toBeVisible({ timeout: 15_000 });
    await expect(hostIn.getByText(guest.name)).toHaveCount(0);

    // Accepted: their own record.
    await unwrap(await guestHome.request.post(`/api/auth/invitations/${space.slug}/accept`), 'accept');
    const after = await unwrap<any>(await hostIn.request.get(`/api/users/${invited.id}`), 'after accepting');
    expect(after.full_name).toBe(guest.name);
    // Now theirs, and in another space too: the shared fields are the platform's.
    expect(after.shared_fields_locked).toBe(true);
  });

  test('an invited account’s last change is not read through: updated_at is the invitation’s own', async ({ page, as }) => {
    const host = { email: `host.u.s13.${S13_STAMP}@example.com`, name: 'Hugo Host' };
    const guest = { email: `guest.u.s13.${S13_STAMP}@example.com`, name: 'Ulla Ownname' };
    await s13SignUp(page, host.email, host.name);
    await s13SignUp(page, guest.email, guest.name);
    const guestHome = await as('admin', { email: guest.email, org: null });
    await unwrap(await guestHome.request.post('/api/spaces', { data: { name: `Ulla Nook ${S13_STAMP}` } }), 'the guest’s own space');
    // A later sign-in (anywhere) moves the account's own updated_at.
    await page.waitForTimeout(50);
    await unwrap(
      await page.request.post('/api/auth/google', { data: { credential: `fake:google:upd-${S13_STAMP}:${guest.email}:1`, signup: true } }),
      'the guest signs in again',
    );
    const hostHome = await as('admin', { email: host.email, org: null });
    const space = await unwrap<any>(await hostHome.request.post('/api/spaces', { data: { name: `Hugo Hall ${S13_STAMP}` } }), 'the host’s space');
    const hostIn = await as('admin', { email: host.email, org: space.slug });

    const pairs: [string, string][] = [
      [guest.email, 'Ulla (typed)'],
      [`fresh.u.s13.${S13_STAMP}@example.com`, 'Fresh (typed)'],
    ];
    for (const [email, full_name] of pairs) {
      const invited = await unwrap<any>(
        await hostIn.request.post('/api/users', { data: inviteRowRequest({ email, full_name, role: 'parent' }) }),
        `invite ${email}`,
      );
      expect(invited.status).toBe('invited');
      expect(invited.updated_at, email).toBe(invited.created_at);
      const read = await unwrap<any>(await hostIn.request.get(`/api/users/${invited.id}`), 'reading');
      expect(read.updated_at, email).toBe(read.created_at);
      const listed = await unwrap<any[]>(await hostIn.request.get(`/api/users?search=${encodeURIComponent(email)}`), 'listed');
      expect(listed).toHaveLength(1);
      expect(listed[0].updated_at, email).toBe(listed[0].created_at);
    }
  });

  test('inviting an address with an account and one without logs the same action and wording', async ({ page, as }) => {
    const host = { email: `host.l.s13.${S13_STAMP}@example.com`, name: 'Lena Host' };
    const guest = { email: `guest.l.s13.${S13_STAMP}@example.com`, name: 'Leopold Ownname' };
    await s13SignUp(page, host.email, host.name);
    await s13SignUp(page, guest.email, guest.name);
    const guestHome = await as('admin', { email: guest.email, org: null });
    await unwrap(await guestHome.request.post('/api/spaces', { data: { name: `Leo Loft ${S13_STAMP}` } }), 'the guest’s own space');
    const hostHome = await as('admin', { email: host.email, org: null });
    const space = await unwrap<any>(await hostHome.request.post('/api/spaces', { data: { name: `Lena Lodge ${S13_STAMP}` } }), 'the host’s space');
    const hostIn = await as('admin', { email: host.email, org: space.slug });

    const existing = await unwrap<any>(
      await hostIn.request.post('/api/users', { data: inviteRowRequest({ email: guest.email, full_name: 'Known (typed)', role: 'parent' }) }),
      'invite the existing account',
    );
    const unknown = await unwrap<any>(
      await hostIn.request.post('/api/users', { data: inviteRowRequest({ email: `fresh.l.s13.${S13_STAMP}@example.com`, full_name: 'Unknown (typed)', role: 'parent' }) }),
      'invite an unknown address',
    );
    const log = await unwrap<any[]>(await hostIn.request.get('/api/audit?limit=50'), 'the host’s log');
    const lineFor = (id: string) => {
      const lines = log.filter((e) => e.entity_id === id && (e.action === 'user.created' || e.action === 'membership.invited'));
      expect(lines).toHaveLength(1);
      return lines[0];
    };
    const a = lineFor(existing.id);
    const b = lineFor(unknown.id);
    expect(a.action).toBe(b.action);
    expect(a.description.replace('Known (typed)', '<name>')).toBe(b.description.replace('Unknown (typed)', '<name>'));
    expect(JSON.stringify(log)).not.toContain(guest.name);
  });

  test('a declined invitation leaves the inviting space only the name it typed, in its log too', async ({ page, as }) => {
    const host = { email: `host.d.s13.${S13_STAMP}@example.com`, name: 'Hester Host' };
    const guest = { email: `guest.d.s13.${S13_STAMP}@example.com`, name: 'Drusilla Ownname' };
    await s13SignUp(page, host.email, host.name);
    await s13SignUp(page, guest.email, guest.name);
    const guestHome = await as('admin', { email: guest.email, org: null });
    await unwrap(await guestHome.request.post('/api/spaces', { data: { name: `Dru Corner ${S13_STAMP}` } }), 'the guest’s own space');
    const hostHome = await as('admin', { email: host.email, org: null });
    const space = await unwrap<any>(await hostHome.request.post('/api/spaces', { data: { name: `Host Den ${S13_STAMP}` } }), 'the host’s space');
    const hostIn = await as('admin', { email: host.email, org: space.slug });

    await unwrap<any>(
      await hostIn.request.post('/api/users', { data: { full_name: 'Decliner (typed)', email: guest.email, roles: ['parent'], status: 'active' } }),
      'invite',
    );
    await unwrap(await guestHome.request.post(`/api/auth/invitations/${space.slug}/decline`), 'decline');

    const log = await unwrap<any[]>(await hostIn.request.get('/api/audit?limit=50'), 'the host’s log');
    const declined = log.filter((e) => e.action === 'membership.declined');
    expect(declined.length).toBeGreaterThan(0);
    expect(JSON.stringify(declined)).toContain('Decliner (typed)');
    expect(JSON.stringify(log)).not.toContain(guest.name);
    const listed = await unwrap<any[]>(await hostIn.request.get(`/api/users?search=${encodeURIComponent(guest.email)}`), 'listed');
    expect(JSON.stringify(listed)).not.toContain(guest.name);
  });

  test('leaving reveals nothing about the space left', async ({ page, as }) => {
    const owner = { email: `owner.s13.${S13_STAMP}@example.com`, name: 'Odile Owner' };
    const eve = { email: `eve.s13.${S13_STAMP}@example.com`, name: 'Eve Leaver' };
    const stranger = { email: `stranger.s13.${S13_STAMP}@example.com`, name: 'Stan Stranger' };
    await s13SignUp(page, owner.email, owner.name);
    await s13SignUp(page, eve.email, eve.name);
    await s13SignUp(page, stranger.email, stranger.name);
    const ownerHome = await as('admin', { email: owner.email, org: null });
    const spaceName = `Odile Studio ${S13_STAMP}`;
    const space = await unwrap<any>(await ownerHome.request.post('/api/spaces', { data: { name: spaceName } }), 'the space');
    const ownerIn = await as('admin', { email: owner.email, org: space.slug });
    await unwrap(
      await ownerIn.request.post('/api/users', { data: { full_name: 'Eve', email: eve.email, roles: ['parent'], status: 'active' } }),
      'invite Eve',
    );
    const eveHome = await as('admin', { email: eve.email, org: null });
    await unwrap(await eveHome.request.post(`/api/auth/invitations/${space.slug}/accept`), 'Eve accepts');
    expect((await s13Session(eveHome)).memberships.map((m: any) => m.slug)).toEqual([space.slug]);

    // An invitation that is not yet accepted is no membership to leave, and reads like no space at all.
    const strangerHome = await as('admin', { email: stranger.email, org: null });
    await unwrap(
      await ownerIn.request.post('/api/users', { data: { full_name: 'Stan', email: stranger.email, roles: ['parent'], status: 'active' } }),
      'invite Stan',
    );
    const nowhere = await strangerHome.request.post(`/api/spaces/no-such-space-${S13_STAMP}/leave`);
    expect(nowhere.status()).toBe(404);
    const nowhereBody = await nowhere.json();
    const invitedLeave = await strangerHome.request.post(`/api/spaces/${space.slug}/leave`);
    expect(invitedLeave.status()).toBe(404);
    expect(await invitedLeave.json()).toEqual(nowhereBody);
    // Nor is a space one was never asked to (the institute's).
    const notMine = await strangerHome.request.post(`/api/spaces/${ORGS.a.slug}/leave`);
    expect(notMine.status()).toBe(404);
    expect(await notMine.json()).toEqual(nowhereBody);

    // Eve leaves: the answer is that she left, and nothing else.
    const left = await eveHome.request.post(`/api/spaces/${space.slug}/leave`);
    expect(left.status()).toBe(200);
    expect(await left.json()).toEqual({ data: { left: true } });

    // Her own lists no longer carry it, in any form.
    const after = await s13Session(eveHome);
    expect(after.memberships).toEqual([]);
    expect(after.invitations).toEqual([]);
    expect(after.join_requests).toEqual([]);
    const text = JSON.stringify(after);
    expect(text).not.toContain(space.slug);
    expect(text).not.toContain(spaceName);
    // Naming it on a request finds no way in.
    const named = await s13Session(eveHome, space.slug);
    expect(named.organization).toBeNull();
    for (const path of SPACE_READS) {
      const response = await eveHome.request.get(path, { headers: { 'X-Organization': space.slug } });
      expect(response.status(), path).toBe(403);
      expect((await response.json()).error.code, path).toBe('organization_required');
    }
    // Leaving again reads exactly like a space that never existed.
    const again = await eveHome.request.post(`/api/spaces/${space.slug}/leave`);
    expect(again.status()).toBe(404);
    expect(await again.json()).toEqual(nowhereBody);
    // And the old route, naming it, is refused like any space she is not in.
    const oldRoute = await eveHome.request.post('/api/organization/leave', { headers: { 'X-Organization': space.slug } });
    expect(oldRoute.status()).toBe(403);

    // The Spaces page shows no trace of it.
    await eveHome.goto('/spaces');
    await expect(eveHome.getByTestId('spaces-page')).toBeVisible({ timeout: 15_000 });
    await expect(eveHome.getByTestId(`org-${space.slug}`)).toHaveCount(0);
    await expect(eveHome.getByTestId(`invitation-${space.slug}`)).toHaveCount(0);
    await expect(eveHome.getByTestId('spaces-page')).not.toContainText(spaceName);
  });
});

/**
 * S13 defects proposed in round review (Phase 61): an existing account's sign-ins do not show
 * through a space's record of them; a suspended admin is not the space's last admin; and a request
 * to an archived space is not pending.
 */
test.describe('S13: what does not cross spaces', () => {
  test('a sign-in anywhere does not move updated_at on any space’s record of the person', async ({ page, as }) => {
    const host = { email: `host.t.s13.${S13_STAMP}@example.com`, name: 'Tamsin Host' };
    const guest = { email: `guest.t.s13.${S13_STAMP}@example.com`, name: 'Tobias Ownname' };
    await s13SignUp(page, host.email, host.name);
    await s13SignUp(page, guest.email, guest.name);
    const guestHome = await as('admin', { email: guest.email, org: null });
    await unwrap(await guestHome.request.post('/api/spaces', { data: { name: `Tobi Nook ${S13_STAMP}` } }), 'the guest’s own space');
    await page.waitForTimeout(2_000);
    const hostHome = await as('admin', { email: host.email, org: null });
    const space = await unwrap<any>(await hostHome.request.post('/api/spaces', { data: { name: `Tamsin Hall ${S13_STAMP}` } }), 'the host’s space');
    const hostIn = await as('admin', { email: host.email, org: space.slug });

    const within = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 1_000;
    const ids: Record<string, string> = {};
    for (const [email, full_name] of [[guest.email, 'Tobias (typed)'], [`fresh.t.s13.${S13_STAMP}@example.com`, 'Fresh T (typed)']] as const) {
      const invited = await unwrap<any>(
        await hostIn.request.post('/api/users', { data: inviteRowRequest({ email, full_name, role: 'parent' }) }),
        `invite ${email}`,
      );
      expect(within(invited.updated_at, invited.created_at), `${email}: ${invited.updated_at} vs ${invited.created_at}`).toBe(true);
      ids[email] = invited.id;
    }
    const signIn = async () =>
      unwrap(
        await page.request.post('/api/auth/google', { data: { credential: `fake:google:tsi-${S13_STAMP}:${guest.email}:1`, signup: true } }),
        'the guest signs in again',
      );
    const readGuest = async () => (await unwrap<any>(await hostIn.request.get(`/api/users/${ids[guest.email]}`), 'reading the guest')).updated_at;

    // Invited: a sign-in elsewhere changes nothing here.
    const invitedAt = await readGuest();
    await page.waitForTimeout(50);
    await signIn();
    expect(await readGuest()).toBe(invitedAt);

    // Accepted: still nothing -- when they last signed in is their own (R6, R13).
    await unwrap(await guestHome.request.post(`/api/auth/invitations/${space.slug}/accept`), 'accept');
    const acceptedAt = await readGuest();
    await page.waitForTimeout(50);
    await signIn();
    expect(await readGuest()).toBe(acceptedAt);
    const listed = await unwrap<any[]>(await hostIn.request.get(`/api/users?search=${encodeURIComponent(guest.email)}`), 'listed');
    expect(listed[0].updated_at).toBe(acceptedAt);
  });

  test('a suspended admin leaves while an active admin remains: not refused as the last admin', async ({ page, as }) => {
    const owner = { email: `owner.x.s13.${S13_STAMP}@example.com`, name: 'Xavier Owner' };
    const b = { email: `b.x.s13.${S13_STAMP}@example.com`, name: 'Bea Paused' };
    await s13SignUp(page, owner.email, owner.name);
    await s13SignUp(page, b.email, b.name);
    const ownerHome = await as('admin', { email: owner.email, org: null });
    const space = await unwrap<any>(await ownerHome.request.post('/api/spaces', { data: { name: `Xavier Place ${S13_STAMP}` } }), 'the space');
    const ownerIn = await as('admin', { email: owner.email, org: space.slug });
    const added = await unwrap<any>(
      await ownerIn.request.post('/api/users', { data: inviteRowRequest({ email: b.email, full_name: b.name, role: 'admin' }) }),
      'invite B as admin',
    );
    const bHome = await as('admin', { email: b.email, org: null });
    await unwrap(await bHome.request.post(`/api/auth/invitations/${space.slug}/accept`), 'B accepts');
    await unwrap(await ownerIn.request.patch(`/api/users/${added.id}`, { data: { status: 'suspended' } }), 'suspend B');

    const left = await bHome.request.post(`/api/spaces/${space.slug}/leave`);
    expect(left.status(), await left.text()).toBe(200);
    expect(await left.json()).toEqual({ data: { left: true } });
    expect((await s13Session(bHome)).memberships.map((m: any) => m.slug)).not.toContain(space.slug);
  });

  test('a request to a space since archived is not listed, and does not stop landing in the one space', async ({ page, as }) => {
    const host = { email: `host.z.s13.${S13_STAMP}@example.com`, name: 'Zora Host' };
    const asker = { email: `asker.z.s13.${S13_STAMP}@example.com`, name: 'Zeke Asker' };
    await s13SignUp(page, host.email, host.name);
    await s13SignUp(page, asker.email, asker.name);
    const hostHome = await as('admin', { email: host.email, org: null });
    const z = await unwrap<any>(await hostHome.request.post('/api/spaces', { data: { name: `Zora Zone ${S13_STAMP}` } }), 'space Z');
    const hostIn = await as('admin', { email: host.email, org: z.slug });
    const code = await unwrap<any>(await hostIn.request.get('/api/organization/code'), 'Z’s code');
    const askerHome = await as('admin', { email: asker.email, org: null });
    const a = await unwrap<any>(await askerHome.request.post('/api/spaces', { data: { name: `Zeke Attic ${S13_STAMP}` } }), 'space A');
    await unwrap(await askerHome.request.post('/api/spaces/join-requests', { data: { code: code.code } }), 'asking Z');
    expect((await s13Session(askerHome)).join_requests.map((r: any) => r.slug)).toEqual([z.slug]);

    const platform = await as('platformAdmin', { org: null });
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'the spaces');
    const zRow = orgs.find((o) => o.slug === z.slug);
    await unwrap(await platform.request.post(`/api/platform/organizations/${zRow.id}/archive`), 'archive Z');
    await unwrap(await askerHome.request.put('/api/auth/default-organization', { data: { slug: null } }), 'no last choice');

    const after = await s13Session(askerHome);
    expect(after.join_requests).toEqual([]);
    expect(JSON.stringify(ownLists(after))).not.toContain(z.slug);
    expect(decideLanding(after)).toBe(a.slug);

    const arriving = await as('admin', { email: asker.email, org: null });
    await arriving.goto('/');
    await expect(arriving.getByTestId('org-switcher').filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(arriving).not.toHaveURL(/\/spaces/);
  });
});
