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
