import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * Phase 62, P0 (docs/stickiness-plan.md; owner, 2026-11-01): the console's sign-in switches. Platform
 * admins choose, for the web portal and the app separately, which ways in besides Google and whether
 * new people may sign up, for a few hours or until changed. The app says it is the app with
 * `X-Client: app`; anything else is the web. Locally every provider is set up (fake tokens), and the
 * defaults are .dev.vars': every provider, sign-up open.
 *
 * Serial: one platform-wide setting, changed and put back by each step.
 */
test.describe.configure({ mode: 'serial' });

const APP = { 'X-Client': 'app' };
const fake = (provider: string, subject: string, email: string) => `fake:${provider}:${subject}:${email}:1`;

test.describe('sign-in switches', () => {
  test.afterEach(async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    for (const client of ['web', 'app']) {
      await platform.request.put('/api/platform/sign-in', { data: { client, setting: null } });
    }
  });

  test('the app gets its own providers and sign-up switch, and the web keeps its defaults', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const status = await unwrap<any>(await platform.request.get('/api/platform/sign-in'), 'reading the switches');
    expect(status.clients.map((c: any) => c.client)).toEqual(['web', 'app']);
    expect(status.configured).toContain('facebook');

    const saved = await unwrap<any>(
      await platform.request.put('/api/platform/sign-in', {
        data: { client: 'app', setting: { providers: ['facebook'], signup_open: false, hours: 1 } },
      }),
      'switching the app to Google and Facebook, sign-up closed, for an hour',
    );
    const app = saved.clients.find((c: any) => c.client === 'app');
    expect(app.effective).toMatchObject({ providers: ['google', 'facebook'], signup_open: false, source: 'console' });
    expect(Date.parse(app.effective.until) - Date.now()).toBeGreaterThan(55 * 60_000);

    // What each client is told. (Locally sign-in is off, so the config lists no buttons; the routes
    // below show which providers each client may use.)
    const appConfig = await unwrap<any>(await platform.request.get('/api/auth/config', { headers: APP }), 'app config');
    expect(appConfig.signup_open).toBe(false);
    const webConfig = await unwrap<any>(await platform.request.get('/api/auth/config'), 'web config');
    expect(webConfig.signup_open).toBe(true);
    const web = saved.clients.find((c: any) => c.client === 'web');
    expect(web.effective).toMatchObject({ providers: ['google', 'microsoft', 'apple', 'facebook'], source: 'defaults' });

    // The app may no longer use Microsoft; the web still may.
    const refused = await platform.request.post('/api/auth/microsoft', {
      headers: APP,
      data: { id_token: fake('microsoft', 'p0-app', 'nobody@example.com') },
    });
    expect(refused.status()).toBe(404);
    const allowed = await platform.request.post('/api/auth/microsoft', {
      data: { id_token: fake('microsoft', 'p0-web', 'nobody@example.com') },
    });
    expect(allowed.status()).not.toBe(404);

    // Logged as a platform line, with no address or token in it.
    const audit = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'the console log');
    const line = audit.find((row) => row.action === 'platform.sign_in_updated');
    expect(line?.description).toBe('Set sign-in for the app: Google and Facebook, sign-up closed, for 1 hour.');
  });

  test('closed sign-up for the app refuses a newcomer there, while the web still signs them up', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await unwrap(
      await platform.request.put('/api/platform/sign-in', {
        data: { client: 'app', setting: { providers: [], signup_open: false, hours: null } },
      }),
      'closing sign-up in the app',
    );
    const newcomer = `p0-${Date.now().toString(36)}@example.com`;
    const fromApp = await platform.request.post('/api/auth/google', {
      headers: APP,
      data: { credential: fake('google', `p0-app-${newcomer}`, newcomer), signup: true },
    });
    expect(fromApp.status()).toBe(403);
    expect((await fromApp.json()).error.code).toBe('no_account');

    const fromWeb = await unwrap<any>(
      await platform.request.post('/api/auth/google', {
        data: { credential: fake('google', `p0-web-${newcomer}`, newcomer), signup: true },
      }),
      'a newcomer on the web',
    );
    expect(fromWeb.signup?.token).toBeTruthy();
  });

  test('a lapsed setting is as good as none, and Back to defaults clears it', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await unwrap(
      await platform.request.put('/api/platform/sign-in', {
        data: { client: 'web', setting: { providers: [], signup_open: false, hours: 1 } },
      }),
      'a web setting',
    );
    let status = await unwrap<any>(await platform.request.get('/api/platform/sign-in'), 'reading');
    expect(status.clients[0].effective.source).toBe('console');

    status = await unwrap<any>(
      await platform.request.put('/api/platform/sign-in', { data: { client: 'web', setting: null } }),
      'back to defaults',
    );
    expect(status.clients[0].setting).toBeNull();
    expect(status.clients[0].effective).toMatchObject({ source: 'defaults', signup_open: true });
  });

  test('only a platform admin may read or change them', async ({ as }) => {
    const admin = await as('admin');
    expect((await admin.request.get('/api/platform/sign-in')).status()).toBe(403);
    expect(
      (
        await admin.request.put('/api/platform/sign-in', {
          data: { client: 'app', setting: { providers: [], signup_open: true, hours: 1 } },
        })
      ).status(),
    ).toBe(403);
    // An unknown duration is refused before anything is stored.
    const platform = await as('platformAdmin', { org: null });
    const bad = await platform.request.put('/api/platform/sign-in', {
      data: { client: 'app', setting: { providers: [], signup_open: true, hours: 5 } },
    });
    expect(bad.status()).toBe(422);
  });

  test('the console page switches the app and shows what is in force', async ({ as }) => {
    const page = await as('platformAdmin', { org: null });
    await page.goto('/platform/settings');
    const card = page.getByTestId('sign-in-app');
    await expect(card.getByTestId('sign-in-app-in-force')).toContainText("This address's defaults");
    await card.getByRole('switch', { name: 'Microsoft for the app' }).click();
    await card.getByRole('button', { name: '1 hour' }).click();
    await card.getByRole('button', { name: 'Save' }).click();
    await expect(card.getByTestId('sign-in-app-in-force')).toContainText('Google, Apple and Facebook');
    await expect(card.getByTestId('sign-in-app-in-force')).toContainText('until');
    await card.getByRole('button', { name: 'Back to defaults' }).click();
    await expect(card.getByTestId('sign-in-app-in-force')).toContainText("This address's defaults");
  });
});
