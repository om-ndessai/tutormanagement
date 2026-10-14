import { expect, type APIResponse, type Page } from '@playwright/test';

/**
 * Unwraps an API response, failing with the server's own message rather than
 * a downstream `undefined is not an object`.
 *
 * Worth the indirection: the first production run of this suite failed with
 * "Cannot read properties of undefined", which said nothing about the actual
 * cause.
 */
export async function unwrap<T = any>(response: APIResponse, what: string): Promise<T> {
  const text = await response.text();

  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${what}: expected JSON, got ${response.status()}\n${text.slice(0, 300)}`);
  }

  if (!response.ok() || body?.data === undefined) {
    throw new Error(
      `${what}: HTTP ${response.status()}\n${JSON.stringify(body?.error ?? body).slice(0, 400)}`,
    );
  }

  return body.data as T;
}

/**
 * Looks a person up by email, since ids are generated on every rebuild.
 *
 * Deliberately takes no identity override: the calling page's context already
 * carries an X-Dev-User header, and adding a second one per request produced
 * an ambiguous value that the Worker could not resolve.
 */
export async function idOf(page: Page, email: string): Promise<string> {
  const response = await page.request.get(`/api/users?search=${encodeURIComponent(email)}`);
  const users = await unwrap<{ id: string }[]>(response, `looking up ${email}`);

  expect(users.length, `expected to find ${email}`).toBeGreaterThan(0);
  return users[0]!.id;
}

/**
 * Phase 33: ids of a pairing's location of one kind, to schedule with. A schedule needs at least
 * one. Seeded pairings have their tutor's in-person place and online room; a pairing a test
 * made itself has none, so with an admin's page one is added for the tutor and allowed.
 */
export async function scheduleLocationIds(
  page: Page,
  tutorId: string,
  studentId: string,
  kind: 'physical' | 'virtual' = 'physical',
): Promise<string[]> {
  const pairings = await unwrap<any[]>(
    await page.request.get(`/api/assignments?tutor_user_id=${tutorId}&student_user_id=${studentId}`),
    'reading the pairing',
  );
  const pairing = pairings[0];
  if (!pairing) throw new Error('scheduleLocationIds: no pairing for that tutor and student');
  const existing = (pairing.locations as any[]).find((l) => l.kind === kind && l.owner_user_id === tutorId)
    ?? (pairing.locations as any[]).find((l) => l.kind === kind);
  if (existing) return [existing.id];

  const created = await unwrap<any>(
    await page.request.post('/api/locations', {
      data: { owner_user_id: tutorId, name: kind === 'virtual' ? 'Test room' : 'Test studio', kind, reminder_minutes: 0 },
    }),
    'adding a location for the tutor',
  );
  await unwrap<any>(
    await page.request.put(`/api/assignments/${pairing.id}/locations`, {
      data: { location_ids: [...(pairing.locations as any[]).map((l) => l.id), created.id] },
    }),
    'allowing it for the pairing',
  );
  return [created.id];
}
