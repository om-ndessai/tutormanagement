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

    await platform.getByRole('button', { name: 'New space' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Lakeside Learning');
    await expect(dialog.getByLabel('Address name')).toHaveValue('lakeside-learning');
    await dialog.getByLabel('Short name').fill('Lakeside');
    await dialog.getByRole('radio', { name: 'Forest' }).click();
    await dialog.getByRole('button', { name: 'Create space' }).click();
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
    // Phase 59: left as it opens, families pay each tutor directly -- no payer details.
    expect(lakeside.business).toBeNull();
    expect(lakeside.payer).toBeNull();
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

    // Phase 34: a new organization starts on Beast Academy, its default
    // curriculum, so its first admin reads the eight levels.
    expect((await lena.request.post('/api/auth/invitations/lakeside-learning/accept')).ok()).toBe(true);
    const curriculum = await unwrap<any[]>(
      await lena.request.get('/api/curriculum', { headers: { 'X-Organization': 'lakeside-learning' } }),
      'Lakeside curriculum',
    );
    expect(curriculum.map((level) => level.id)).toEqual([
      'BA1', 'BA2', 'BA3', 'BA4', 'BA5', 'PRE', 'ALG', 'GEO',
    ]);

    // Archiving shuts it: nobody enters an archived organization.
    await unwrap(
      await platform.request.post(`/api/platform/organizations/${lakeside.id}/archive`),
      'archiving',
    );
    // An archived organization's invitations cannot be answered, and it cannot
    // be entered -- not even by its admin.
    expect((await lena.request.post('/api/auth/invitations/lakeside-learning/accept')).status()).toBe(404);
    expect(
      (await lena.request.get('/api/dashboard', { headers: { 'X-Organization': 'lakeside-learning' } })).status(),
    ).toBe(403);
  });

  test('the console makes a space that collects its payments, with its own payer details (Phase 59)', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    await platform.goto('/platform');
    await platform.getByRole('button', { name: 'New space' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Hillside Learning');
    await dialog.getByLabel('Short name').fill('Hillside');
    // Who families pay is Tutoring's: it appears once Tutoring is ticked (owner, 2026-11-04).
    await dialog.getByTestId('org-feature-sets').getByRole('switch', { name: 'Tutoring', exact: true }).click();
    // Who families pay: each tutor until chosen; the space shows its payer details.
    const who = dialog.getByRole('radiogroup', { name: 'Who families pay' });
    await expect(who.getByRole('radio', { name: /Each tutor, directly/ })).toBeChecked();
    await expect(dialog.getByTestId('org-payer')).toHaveCount(0);
    await who.getByRole('radio', { name: /The space/ }).check();
    // Never an SSN as the payer's TIN.
    await dialog.getByLabel(/Payer TIN/).fill('123-45-6789');
    await dialog.getByRole('button', { name: 'Create space' }).click();
    await expect(dialog.getByText(/looks like a Social Security number/)).toBeVisible();
    await dialog.getByLabel(/Payer TIN/).fill('77-1234567');
    await dialog.getByLabel('City').fill('Durham');
    await dialog.getByRole('button', { name: 'Create space' }).click();
    await expect(platform.getByText('Hillside Learning created.')).toBeVisible();
    await expect(dialog.getByText(/organization/i)).toHaveCount(0);

    const orgs = await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'list');
    const hillside = orgs.find((org) => org.slug === 'hillside-learning');
    // Its own payer record, keyed by the space, named after it when no name is given.
    expect(hillside.business).toEqual({ id: hillside.id, name: 'Hillside Learning' });
    expect(hillside.payer).toMatchObject({ name: 'Hillside Learning', tin: '77-1234567', payer_city: 'Durham' });
    const log = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'the platform log');
    expect(log.some((e: any) => e.action === 'organization.created' && e.description === 'Created the space Hillside Learning; it collects its families’ payments')).toBe(true);

    // Edited: families pay each tutor from now on, and the payer details are kept for a switch back.
    await platform.getByRole('button', { name: 'Edit Hillside Learning' }).click();
    const edit = platform.getByRole('dialog');
    await expect(edit.getByLabel(/Payer TIN/)).toHaveValue('77-1234567');
    await edit.getByRole('radio', { name: /Each tutor, directly/ }).check();
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(platform.getByText('Hillside Learning saved.')).toBeVisible();
    const after = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'list')).find(
      (org) => org.slug === 'hillside-learning',
    );
    expect(after.business).toBeNull();

    // Unlinked, Hillside's own payer record is still Hillside's: an older app cannot hand it to
    // another space, by linking it or by a create that names it (S2, decision 5).
    const otherSlug = `s2-other-${Date.now().toString(36)}`;
    const other = await unwrap<any>(
      await platform.request.post('/api/platform/organizations', {
        data: { name: `S2 Other ${otherSlug}`, short_name: 'S2 Other', slug: otherSlug },
      }),
      'another space',
    );
    const linked = await platform.request.put(`/api/platform/organizations/${other.id}/business`, {
      data: { business_id: hillside.id },
    });
    expect(linked.status()).toBe(409);
    expect((await linked.json()).error.code).toBe('shared_payer');
    const otherAfter = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'list')).find(
      (org) => org.slug === otherSlug,
    );
    expect(otherAfter.business).toBeNull();
    const copied = await platform.request.post('/api/platform/organizations', {
      data: { name: 'Copycat2', short_name: 'Copycat2', slug: `copycat2-${otherSlug}`, business_id: hillside.id },
    });
    expect(copied.status()).toBe(409);
    expect((await copied.json()).error.code).toBe('shared_payer');

    await unwrap(
      await platform.request.put(`/api/platform/organizations/${hillside.id}/payment-model`, { data: { model: 'space' } }),
      'collecting again',
    );
    const again = (await unwrap<any[]>(await platform.request.get('/api/platform/organizations'), 'list')).find(
      (org) => org.slug === 'hillside-learning',
    );
    expect(again.payer).toMatchObject({ tin: '77-1234567' });
    // Switched back, no payer record names two spaces, and Hillside's names Hillside alone.
    const records = await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'payer records');
    for (const record of records) expect(record.spaces.length, record.id).toBeLessThanOrEqual(1);
    const own = records.find((record) => record.id === hillside.id);
    expect(own.spaces.map((space: any) => space.slug)).toEqual(['hillside-learning']);

    // An older app's create still names a business, but never one another space has.
    const shared = await platform.request.post('/api/platform/organizations', {
      data: { name: 'Copycat', short_name: 'Copycat', slug: 'copycat', business_id: hillside.id },
    });
    expect(shared.status()).toBe(409);
    expect((await shared.json()).error.code).toBe('shared_payer');
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

/**
 * Phase 59, S2 (docs/spaces-plan.md): a space's payer details are its own. The console makes a space
 * either way -- "The space" collects, "Each tutor, directly" is paid directly -- with no separate
 * payer records on screen; underneath, one `businesses` row per space, keyed by its id, never shared.
 * Phase 54's routes still answer for app builds already on phones. Every test makes its own spaces.
 */
test.describe('S2: who families pay, from the console', () => {
  const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

  async function listed(page: import('@playwright/test').Page, slug: string): Promise<any> {
    const orgs = await unwrap<any[]>(await page.request.get('/api/platform/organizations'), 'the spaces');
    const found = orgs.find((org) => org.slug === slug);
    expect(found, `the space ${slug}`).toBeTruthy();
    return found;
  }

  test('a space made as it opens has families pay each tutor, and switching it to the space shows its own payer details', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const tag = stamp();
    const name = `S2 Direct ${tag}`;
    const slug = `s2-direct-${tag}`;

    await platform.goto('/platform');
    // No separate payer records on screen.
    await expect(platform.getByRole('link', { name: /Organizations/ })).toHaveCount(0);
    await platform.getByRole('button', { name: 'New space' }).click();
    const dialog = platform.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await expect(dialog.getByLabel('Address name')).toHaveValue(slug);
    await dialog.getByLabel('Short name').fill('S2 Direct');
    await dialog.getByTestId('org-feature-sets').getByRole('switch', { name: 'Tutoring', exact: true }).click();
    const who = dialog.getByRole('radiogroup', { name: 'Who families pay' });
    await expect(who.getByRole('radio')).toHaveCount(2);
    await expect(who.getByRole('radio', { name: /Each tutor, directly/ })).toBeChecked();
    await expect(dialog.getByTestId('org-payer')).toHaveCount(0);
    await expect(dialog.getByText(/organization/i)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Create space' }).click();
    await expect(platform.getByText(`${name} created.`, { exact: false })).toBeVisible();

    // The space's row in the list, not the toast (also a listitem) that names it.
    const row = platform.getByRole('list', { name: 'Spaces' }).getByRole('listitem').filter({ hasText: name });
    await expect(row).toContainText('families pay each tutor');
    const made = await listed(platform, slug);
    expect(made.business).toBeNull();
    expect(made.payer).toBeNull();
    // Nothing made underneath while families pay each tutor.
    const records = await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'payer records');
    expect(records.find((b: any) => b.id === made.id)).toBeUndefined();

    // Switched to the space: its payer details appear, and are its own.
    await platform.getByRole('button', { name: `Edit ${name}` }).click();
    const edit = platform.getByRole('dialog');
    await expect(edit.getByText('A change applies from now on; recorded lessons and payments keep theirs.')).toBeVisible();
    await edit.getByRole('radio', { name: /The space/ }).check();
    await expect(edit.getByTestId('org-payer')).toBeVisible();
    await edit.getByLabel('Name on the 1099').fill(`S2 Payer ${tag} LLC`);
    await edit.getByLabel(/Payer TIN/).fill('56-7654321');
    await edit.getByLabel('City').fill('Cary');
    await expect(edit.getByText(/organization/i)).toHaveCount(0);
    await edit.getByRole('button', { name: 'Save' }).click();
    await expect(platform.getByText(`${name} saved.`)).toBeVisible();
    await expect(row).toContainText('families pay the space');

    const collecting = await listed(platform, slug);
    expect(collecting.business).toEqual({ id: made.id, name: `S2 Payer ${tag} LLC` });
    expect(collecting.payer).toMatchObject({ name: `S2 Payer ${tag} LLC`, tin: '56-7654321', payer_city: 'Cary' });

    // Reopened, the dialog reads the space's own details back.
    await platform.getByRole('button', { name: `Edit ${name}` }).click();
    const again = platform.getByRole('dialog');
    await expect(again.getByRole('radio', { name: /The space/ })).toBeChecked();
    await expect(again.getByLabel(/Payer TIN/)).toHaveValue('56-7654321');
    await expect(again.getByLabel('City')).toHaveValue('Cary');
    await platform.keyboard.press('Escape');

    // The switch is in the space's log, labelled in the space's words.
    const log = await unwrap<any[]>(await platform.request.get('/api/platform/audit'), 'the platform log');
    const mine = log.filter((e: any) => e.organization_id === made.id);
    expect(mine.some((e: any) => e.action === 'organization.created'
      && e.description === `Created the space ${name}; families pay each tutor directly`)).toBe(true);
    expect(mine.some((e: any) => e.action === 'organization.business_set'
      && e.description === `Set ${name} to collect its families’ payments from now on`)).toBe(true);
    // Never the TIN.
    expect(JSON.stringify(mine)).not.toContain('56-7654321');

    await unwrap(await platform.request.post(`/api/platform/organizations/${made.id}/archive`), 'tidying away');
  });

  test('the API makes a space either way, keyed by its own id, and an older app’s routes still answer', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const tag = stamp();
    const create = (slug: string, data: Record<string, unknown>) =>
      platform.request.post('/api/platform/organizations', {
        data: { name: `S2 ${slug} ${tag}`, short_name: 'S2', slug: `s2-${slug}-${tag}`, ...data },
      });

    const collecting = await unwrap<any>(
      await create('collects', { payment_model: 'space', tin: '31-1112223', payer_city: 'Apex', payer_state: 'nc' }),
      'a space that collects',
    );
    // Its own payer record: the space's id, named after it when no name is given.
    expect(collecting.business).toEqual({ id: collecting.id, name: collecting.name });
    const direct = await unwrap<any>(await create('direct', { payment_model: 'direct' }), 'a space paid directly');
    expect(direct.business).toBeNull();
    // An older app sends no payment model: no business is paid directly, as in Phase 54.
    const older = await unwrap<any>(await create('older', { business_id: null }), 'an older app’s create');
    expect(older.business).toBeNull();
    // Neither model by name is refused.
    expect((await create('neither', { payment_model: 'business' })).status()).toBe(422);

    const collectingRow = await listed(platform, collecting.slug);
    expect(collectingRow.payer).toMatchObject({ name: collecting.name, tin: '31-1112223', payer_city: 'Apex', payer_state: 'NC' });
    expect((await listed(platform, direct.slug)).payer).toBeNull();

    // A space paid directly has no payer details to edit.
    const early = await platform.request.patch(`/api/platform/organizations/${direct.id}`, { data: { tin: '31-9998887' } });
    expect(early.status()).toBe(409);
    expect((await early.json()).error.code).toBe('paid_directly');
    // Never an SSN as a TIN.
    expect(
      (await platform.request.patch(`/api/platform/organizations/${collecting.id}`, { data: { tin: '123-45-6789' } })).status(),
    ).toBe(422);

    // GET /api/platform/businesses still answers, one record per space, never shared.
    const records = await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'older app list');
    const own = records.find((b: any) => b.id === collecting.id);
    expect(own?.spaces.map((s: any) => s.slug)).toEqual([collecting.slug]);
    expect(own?.tin).toBe('31-1112223');
    expect(records.find((b: any) => b.id === direct.id)).toBeUndefined();
    for (const record of records) expect(record.spaces.length).toBeLessThanOrEqual(1);
    // An older app linking another space's record is refused.
    const shared = await platform.request.put(`/api/platform/organizations/${direct.id}/business`, {
      data: { business_id: collecting.id },
    });
    expect(shared.status()).toBe(409);
    expect((await shared.json()).error.code).toBe('shared_payer');
    expect((await listed(platform, direct.slug)).business).toBeNull();

    // An older app's "no business" is families paying each tutor; its own record back is fine.
    const cleared = await unwrap<any>(
      await platform.request.put(`/api/platform/organizations/${collecting.id}/business`, { data: { business_id: null } }),
      'an older app clearing it',
    );
    expect(cleared.business).toBeNull();
    const relinked = await unwrap<any>(
      await platform.request.put(`/api/platform/organizations/${collecting.id}/business`, { data: { business_id: collecting.id } }),
      'an older app linking its own back',
    );
    expect(relinked.business?.id).toBe(collecting.id);

    // Choosing the space again restores its own archived record, details kept for the switch back.
    const model = (value: string) =>
      platform.request.put(`/api/platform/organizations/${collecting.id}/payment-model`, { data: { model: value } });
    expect((await unwrap<any>(await model('direct'), 'paid directly')).business).toBeNull();
    await unwrap(await platform.request.post(`/api/platform/businesses/${collecting.id}/archive`), 'archiving the unused record');
    const archived = (await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'list'))
      .find((b: any) => b.id === collecting.id);
    expect(archived.archived_at).not.toBeNull();
    const restored = await unwrap<any>(await model('space'), 'collecting again');
    expect(restored.business).toEqual({ id: collecting.id, name: collecting.name });
    const after = (await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'list'))
      .find((b: any) => b.id === collecting.id);
    expect(after.archived_at).toBeNull();
    expect(after.tin).toBe('31-1112223');
    // The same model again changes nothing.
    expect((await unwrap<any>(await model('space'), 'no change')).business?.id).toBe(collecting.id);

    // Only a platform admin chooses who families pay.
    const admin = await as('admin');
    expect((await admin.request.get('/api/platform/businesses')).status()).toBe(403);
    expect(
      (await admin.request.put(`/api/platform/organizations/${direct.id}/payment-model`, { data: { model: 'space' } })).status(),
    ).toBe(403);

    for (const space of [collecting, direct, older]) {
      await unwrap(await platform.request.post(`/api/platform/organizations/${space.id}/archive`), 'tidying away');
    }
  });

  test('an older app cannot link a payer record keyed by another space, even while that space is paid directly', async ({ as }) => {
    const platform = await as('platformAdmin', { org: null });
    const tag = stamp();
    const create = (slug: string, data: Record<string, unknown>) =>
      platform.request.post('/api/platform/organizations', {
        data: { name: `S2 ${slug} ${tag}`, short_name: 'S2', slug: `s2-${slug}-${tag}`, ...data },
      });
    const a = await unwrap<any>(await create('keyed-a', { payment_model: 'direct' }), 'space A, paid directly');
    const b = await unwrap<any>(await create('keyed-b', { payment_model: 'space', tin: '31-4445556' }), 'space B, collecting');
    const model = (id: string, value: string) =>
      platform.request.put(`/api/platform/organizations/${id}/payment-model`, { data: { model: value } });

    // B now pays directly: its own record stays, unlinked -- and still B's.
    expect((await unwrap<any>(await model(b.id, 'direct'), 'B paid directly')).business).toBeNull();
    const linked = await platform.request.put(`/api/platform/organizations/${a.id}/business`, {
      data: { business_id: b.id },
    });
    expect(linked.status()).toBe(409);
    expect((await linked.json()).error.code).toBe('shared_payer');
    // Nor at creation, by an older app.
    const made = await create('keyed-c', { business_id: b.id });
    expect(made.status()).toBe(409);
    expect((await made.json()).error.code).toBe('shared_payer');

    // B collects again: its record is B's alone, and A never wears it.
    expect((await unwrap<any>(await model(b.id, 'space'), 'B collecting again')).business?.id).toBe(b.id);
    const records = await unwrap<any[]>(await platform.request.get('/api/platform/businesses'), 'payer records');
    for (const record of records) expect(record.spaces.length).toBeLessThanOrEqual(1);
    const aNow = (await listed(platform, a.slug)).business;
    expect(aNow === null || aNow.id === a.id).toBe(true);

    for (const space of [a, b]) {
      await unwrap(await platform.request.post(`/api/platform/organizations/${space.id}/archive`), 'tidying away');
    }
  });
});
