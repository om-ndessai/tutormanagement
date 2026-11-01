import { LAST_ORG_COOKIE, ORG_QUERY_PARAM } from '@tmi/shared';

/**
 * Which organization THIS TAB is in.
 *
 * Kept per tab (sessionStorage), so two tabs can sit in two organizations and
 * neither can act in the other's. The last choice is also remembered for the
 * whole browser in a cookie (with sign-in off, the API reads it in place of the
 * header). Since Phase 60 neither decides where an arriving tab lands: the
 * person's last choice, kept on the server, does. Neither is a secret: the API
 * checks the person's membership on every request.
 */
const TAB_KEY = 'tmi_org';
/** The space this tab last told the server it OPENED (Phase 60, S9): a reload of it is not an opening. */
const ENTERED_KEY = 'tmi_org_entered';
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function getActiveOrg(): string | null {
  try {
    const tab = sessionStorage.getItem(TAB_KEY);
    if (tab) return tab;
  } catch {
    // Storage can be unavailable (a private window); the cookie still works.
  }
  return readCookie(LAST_ORG_COOKIE);
}

/**
 * The space THIS TAB chose -- switched to, entered, or landed in -- or null for a tab that is
 * arriving (just signed in, or freshly opened). An arriving tab lands by the Phase 60 rule
 * (`decideLanding`): the browser's cookie never decides it, the person's last choice on the
 * server does.
 */
export function getTabOrg(): string | null {
  try {
    return sessionStorage.getItem(TAB_KEY) || null;
  } catch {
    return null;
  }
}

/** True once this tab has a space of its own (see getTabOrg). */
export function hasTabOrg(): boolean {
  return getTabOrg() !== null;
}

/**
 * The organization a link names (`?org=<slug>`, as in every notification
 * email), taken off the address so a reload or a copied URL does not keep
 * re-choosing it. Only names a choice: the API still checks membership, and a
 * slug the person cannot enter is passed over for the landing rule.
 */
export function takeLinkedOrg(): string | null {
  try {
    const url = new URL(window.location.href);
    const slug = url.searchParams.get(ORG_QUERY_PARAM)?.trim().toLowerCase();
    if (!slug) return null;
    url.searchParams.delete(ORG_QUERY_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    return slug;
  } catch {
    return null;
  }
}

/** `path` with `?org=<slug>` added (replacing any): a link that names the space, for a sign-in round trip. */
export function withLinkedOrg(path: string, slug: string): string {
  const url = new URL(path, 'http://link.invalid');
  url.searchParams.set(ORG_QUERY_PARAM, slug);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function setActiveOrg(slug: string): void {
  try {
    sessionStorage.setItem(TAB_KEY, slug);
  } catch {
    // See getActiveOrg.
  }
  document.cookie = `${LAST_ORG_COOKIE}=${encodeURIComponent(slug)}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
}

export function clearActiveOrg(): void {
  try {
    sessionStorage.removeItem(TAB_KEY);
    sessionStorage.removeItem(ENTERED_KEY);
  } catch {
    // See getActiveOrg.
  }
}

/**
 * A download or calendar link, naming this tab's organization. Links cannot
 * carry the X-Organization header, so they say it in the URL instead -- and a
 * link copied from one tab still downloads that tab's organization's file.
 */
export function withOrg(url: string): string {
  const slug = getActiveOrg();
  if (!slug) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${ORG_QUERY_PARAM}=${encodeURIComponent(slug)}`;
}

/**
 * Whether this load OPENS the tab's space (Phase 60, S4/S9): true for an arriving tab, a switch, a
 * choice on the Spaces page or a link -- every case where the tab was not already in it -- and false
 * for a reload or a full navigation of a tab that was. Only an opening moves the person's last choice,
 * so one tab's reload never takes back another tab's switch.
 */
export function isOpeningTabOrg(slug: string): boolean {
  try {
    return sessionStorage.getItem(ENTERED_KEY) !== slug;
  } catch {
    return true;
  }
}

/** Notes that this tab has opened `slug` (see isOpeningTabOrg). */
export function markTabOrgEntered(slug: string): void {
  try {
    sessionStorage.setItem(ENTERED_KEY, slug);
  } catch {
    // See getActiveOrg.
  }
}

/** Forgets the tab's opening, so the next load opens its space again (a choice, even of the same one). */
export function forgetTabOrgEntered(): void {
  try {
    sessionStorage.removeItem(ENTERED_KEY);
  } catch {
    // See getActiveOrg.
  }
}
