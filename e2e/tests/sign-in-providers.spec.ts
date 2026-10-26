import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { expect, test, PEOPLE } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 55 (docs/social-login-plan.md): Microsoft, Apple and Facebook beside
 * Google, one person with several ways in. The real providers cannot be
 * reached unattended, so locally the Worker takes the suite's fake tokens
 * (AUTH_FAKE_PROVIDERS, never in production):
 *   fake:<provider>:<subject>:<email or ->:<verified 1|0>[:<name>]
 * They pass through the same completion as a real token: the matching rules,
 * sign-up, linking and refusals are the Worker's own.
 *
 * Serial: the steps build on each other's accounts.
 */
test.describe.configure({ mode: 'serial' });

// A newcomer is new on every run; the seeded people's accounts are the same each time, so a rerun
// on the same database meets them already linked, as a returning person would.
const run = Date.now().toString(36);
const fake = (provider: string, subject: string, email: string | null, verified = true) =>
  `fake:${provider}:${subject}:${email ?? '-'}:${verified ? 1 : 0}`;

test.describe('more ways to sign in', () => {
  test('a verified Microsoft account signs its person in, and is theirs from then on', async ({ as }) => {
    const page = await as('tutor');
    const first = await page.request.post('/api/auth/microsoft', {
      data: { id_token: fake('microsoft', 'alex-ms', PEOPLE.tutor.email) },
    });
    const session = await unwrap<any>(first, 'signing in with Microsoft');
    expect(session.user.full_name).toBe(PEOPLE.tutor.name);

    // The account itself, not the address: a changed address still finds the same person.
    const again = await unwrap<any>(
      await page.request.post('/api/auth/microsoft', {
        data: { id_token: fake('microsoft', 'alex-ms', 'someone.else@example.com') },
      }),
      'signing in again with a changed address',
    );
    expect(again.user.full_name).toBe(PEOPLE.tutor.name);

    // A second Microsoft account with the same address is not Alex's: he has one already.
    const other = await page.request.post('/api/auth/microsoft', {
      data: { id_token: fake('microsoft', 'impostor', PEOPLE.tutor.email) },
    });
    expect(other.status()).toBe(403);
    expect((await other.json()).error.code).toBe('no_account');
  });

  test('an address the provider does not vouch for never joins an account', async ({ as }) => {
    const page = await as('parent');
    const unverified = await page.request.post('/api/auth/microsoft', {
      data: { id_token: fake('microsoft', 'anita-work', PEOPLE.parent.email, false) },
    });
    expect(unverified.status()).toBe(403);
    expect((await unverified.json()).error.message).toMatch(/add Microsoft on My profile/);
  });

  test('a newcomer signs up with Apple, even behind a relay address, and comes back as themselves', async ({ as }) => {
    const page = await as('tutor');
    const relay = `x${run}@privaterelay.appleid.com`;
    const start = await unwrap<any>(
      await page.request.post('/api/auth/apple', {
        data: { id_token: fake('apple', `new-apple-${run}`, relay), name: 'Riley Newcomer', signup: true },
      }),
      'a newcomer at Apple',
    );
    expect(start.signup.email).toBe(relay);
    expect(start.signup.name).toBe('Riley Newcomer');

    const made = await unwrap<any>(
      await page.request.post('/api/auth/signup', {
        data: {
          token: start.signup.token,
          birth_year: 1990,
          birth_month: 5,
          terms_version: TERMS_VERSION,
          privacy_version: PRIVACY_VERSION,
        },
      }),
      'signing up',
    );
    expect(made.user.full_name).toBe('Riley Newcomer');

    const back = await unwrap<any>(
      await page.request.post('/api/auth/apple', {
        data: { id_token: fake('apple', `new-apple-${run}`, relay), signup: true },
      }),
      'signing in again with Apple',
    );
    expect(back.user?.full_name).toBe('Riley Newcomer');
  });

  test('a Facebook account with no address cannot start a sign-up', async ({ as }) => {
    const page = await as('tutor');
    const none = await page.request.post('/api/auth/facebook', {
      data: { access_token: fake('facebook', 'no-email', null), signup: true },
    });
    expect(none.status()).toBe(403);
    expect((await none.json()).error.code).toBe('email_unverified');
  });

  test('My profile adds and removes ways to sign in, never the last', async ({ as }) => {
    const page = await as('student');
    const add = (provider: string, subject: string) =>
      page.request.post(`/api/auth/identities/${provider}`, {
        data: provider === 'facebook' ? { access_token: fake(provider, subject, null) } : { id_token: fake(provider, subject, null) },
      });

    const linked = await unwrap<any[]>(await add('microsoft', 'sofia-ms'), 'adding Microsoft');
    expect(linked.map((row) => row.provider)).toContain('microsoft');
    // One per provider.
    expect((await add('microsoft', 'sofia-ms-2')).status()).toBe(409);
    // Never somebody else's account.
    expect((await add('microsoft', 'alex-ms')).status()).toBe(409);

    const listed = await unwrap<any>(await page.request.get('/api/auth/identities'), 'listing');
    expect(listed.offered).toEqual(expect.arrayContaining(['google', 'microsoft', 'apple', 'facebook']));
    // Nothing that identifies the account at the provider reaches the client.
    expect(JSON.stringify(listed)).not.toContain('sofia-');

    if (listed.identities.length === 1) {
      expect((await page.request.delete('/api/auth/identities/microsoft')).status()).toBe(409);
      await unwrap(await add('facebook', 'sofia-fb'), 'adding Facebook');
    }
    const after = await unwrap<any[]>(await page.request.delete('/api/auth/identities/microsoft'), 'removing Microsoft');
    expect(after.map((row) => row.provider)).not.toContain('microsoft');
  });

  test('the platform log says a way in was added, never which account', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const log = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'the platform log');
    const lines = log.filter((event) => event.action === 'identity.linked' || event.action === 'identity.removed');
    expect(lines.length).toBeGreaterThan(0);
    expect(JSON.stringify(lines)).not.toMatch(/sofia-|alex-ms/);
  });

  test('a provider this address does not offer is not there', async ({ as }) => {
    const page = await as('tutor');
    const config = await unwrap<any>(await page.request.get('/api/auth/config'), 'config');
    // Sign-in is off locally, so no buttons are offered at all.
    expect(config.providers).toEqual([]);
    expect((await page.request.post('/api/auth/myspace', { data: { id_token: 'x' } })).status()).toBe(404);
  });
});
