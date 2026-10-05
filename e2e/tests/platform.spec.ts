import { expect, test } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/** The smallest valid PNG: one transparent pixel. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * The platform console: creating an organization, giving it an admin and a
 * look, and archiving it -- and an organization admin having no way in.
 */
test.describe('the platform console', () => {
  test('a platform admin creates an organization, brands it and adds its admin', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await platform.goto('/');
    await expect(platform).toHaveURL(/\/platform$/);
    await expect(platform.getByText('Platform console')).toBeVisible();

    await platform.getByRole('button', { name: 'New organization' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Lakeside Learning');
    await expect(dialog.getByLabel('Address name')).toHaveValue('lakeside-learning');
    await dialog.getByLabel('Short name').fill('Lakeside');
    await dialog.getByRole('radio', { name: 'Forest' }).click();
    await dialog.getByRole('button', { name: 'Create organization' }).click();
    await expect(platform.getByText('Lakeside Learning created.')).toBeVisible();

    await platform.getByRole('button', { name: 'Edit Lakeside Learning' }).click();
    const edit = platform.getByRole('dialog');

    // A logo: PNG accepted, SVG refused by its bytes whatever it claims to be.
    await edit.getByTestId('logo-input-mark').setInputFiles({ name: 'mark.png', mimeType: 'image/png', buffer: PNG });
    await expect(platform.getByText('Logo updated.')).toBeVisible();
    await edit.getByTestId('logo-input-full').setInputFiles({
      name: 'evil.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
    });
    await expect(platform.getByText(/Upload a PNG or WebP image/)).toBeVisible();

    await edit.getByLabel('Google address').fill('lakeside.admin@gmail.com');
    await edit.locator('#admin-name').fill('Lena Lakeside');
    await edit.getByRole('button', { name: 'Add admin' }).click();
    await expect(edit.getByText('Lena Lakeside')).toBeVisible();
    await expect(edit.getByText('Invited', { exact: true })).toBeVisible();

    // The served logo is the bytes uploaded, locked down.
    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'list');
    const lakeside = orgs.find((org) => org.slug === 'lakeside-learning');
    expect(lakeside.palette).toBe('forest');
    expect(lakeside.admin_count).toBe(1);
    const logo = await platform.request.get(lakeside.logo_mark_url);
    expect(logo.headers()['content-type']).toBe('image/png');
    expect(logo.headers()['x-content-type-options']).toBe('nosniff');
    expect(logo.headers()['content-security-policy']).toContain("default-src 'none'");
    expect(lakeside.logo_full_url).toBeNull();

    // Too big is refused too.
    const big = await platform.request.put(`/api/platform/organizations/${lakeside.id}/logo/full`, {
      data: Buffer.concat([PNG, Buffer.alloc(300 * 1024)]),
      headers: { 'Content-Type': 'image/png' },
    });
    expect(big.status()).toBe(422);

    // The new admin signs in to it -- invited, then active on first sign-in
    // (with sign-in off here, entering is enough to be shown it).
    const lena = await as('admin', { email: 'lakeside.admin@gmail.com', org: null });
    const session = await unwrap<any>(await lena.request.get('/api/auth/session'), 'Lena');
    expect(session.invitations.map((invite: any) => invite.slug)).toContain('lakeside-learning');

    // Archiving shuts it: nobody enters an archived organization.
    await unwrap(
      await platform.request.post(`/api/platform/organizations/${lakeside.id}/archive`),
      'archiving',
    );
    // An archived organization's invitation cannot be accepted, and it cannot
    // be entered.
    expect((await lena.request.post('/api/auth/invitations/lakeside-learning/accept')).status()).toBe(404);
    expect(
      (await lena.request.get('/api/dashboard', { headers: { 'X-Organization': 'lakeside-learning' } })).status(),
    ).toBe(403);
  });

  test('an organization admin cannot reach the console', async ({ as }) => {
    const admin = await as('admin');
    await admin.goto('/platform');
    await expect(admin).not.toHaveURL(/\/platform/);
    expect((await admin.request.post('/api/platform/organizations', {
      data: { name: 'Mine', short_name: 'Mine', slug: 'mine' },
    })).status()).toBe(403);
  });
});
