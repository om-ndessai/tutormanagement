import { test, expect, ORGS } from '../support/fixtures.js';
import { unwrap } from '../support/api.js';

/**
 * R21 (Phase 52, docs/data-exposure.md): a space's code reaches only its admins; a lookup gives its
 * public face alone, and only while joining by code is on; a request reaches the person who made it
 * and that space's admins; a newcomer with no space reads nothing of any space.
 */

const SPACE_READS = ['/api/users', '/api/audit', '/api/organization/settings', '/api/organization/code', '/api/organization/join-requests', '/api/canvas-assessments'];

test.describe('spaces: who sees what (R21)', () => {
  test('a newcomer with no space reads nothing of any space', async ({ as }) => {
    for (const org of [ORGS.a.slug, ORGS.b.slug, ORGS.c.slug]) {
      const nina = await as('admin', { email: 'nina.newcomer@example.com', org });
      for (const path of SPACE_READS) {
        const response = await nina.request.get(path);
        expect(response.status(), `${org} ${path}`).toBe(403);
        expect((await response.json()).error.code).toBe('organization_required');
      }
    }
  });

  test('a lookup shows the face, never the people; the code and requests are the admins’ alone', async ({ as }) => {
    const theo = await as('admin', { email: 'theo.teen@example.com', org: null });
    const found = await unwrap<Record<string, unknown>>(await theo.request.post('/api/spaces/lookup', { data: { code: 'FMXY2345' } }), 'lookup');
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
