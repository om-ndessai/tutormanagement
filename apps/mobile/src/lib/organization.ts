// Ported from apps/web/src/lib/organization.ts @ 1132322
import { ORG_QUERY_PARAM } from '@tmi/shared';

import { readPref, STORAGE_KEYS, writePref } from './storage';

/**
 * Which organization the app is in.
 *
 * The web app keeps this per tab (sessionStorage) and remembers the last choice in a cookie.
 * The app has one "tab": the active organization lives in memory for this run, and the last
 * choice is remembered on the device, which picks where the next launch lands. Neither is a
 * secret: the API checks membership on every request.
 */
let active: string | null = null;

export function getActiveOrg(): string | null {
  return active;
}

/**
 * True once this run has an organization of its own. A run without one is arriving -- just
 * signed in, or freshly launched -- and that is when a default organization decides where the
 * person lands.
 */
export function hasActiveOrg(): boolean {
  return active !== null;
}

export async function setActiveOrg(slug: string): Promise<void> {
  active = slug;
  await writePref(STORAGE_KEYS.lastOrg, slug);
}

export function clearActiveOrg(): void {
  active = null;
}

export async function lastOrg(): Promise<string | null> {
  return readPref(STORAGE_KEYS.lastOrg);
}

export async function forgetLastOrg(): Promise<void> {
  await writePref(STORAGE_KEYS.lastOrg, null);
}

/** A download or calendar path naming the active organization (the client also sends the header). */
export function withOrg(path: string): string {
  if (!active) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${ORG_QUERY_PARAM}=${encodeURIComponent(active)}`;
}
