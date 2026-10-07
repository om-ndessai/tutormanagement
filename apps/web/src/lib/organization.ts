import { LAST_ORG_COOKIE, ORG_QUERY_PARAM } from '@tmi/shared';

/**
 * Which organization THIS TAB is in.
 *
 * Kept per tab (sessionStorage), so two tabs can sit in two organizations and
 * neither can act in the other's. The last choice is also remembered for the
 * whole browser in a cookie, which picks the organization on the next visit
 * and brands the sign-in page. Neither is a secret: the API checks the
 * person's membership on every request.
 */
const TAB_KEY = 'tmi_org';
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
 * True once this tab has an organization of its own -- chosen, switched to, or
 * entered. A tab without one is arriving: just signed in, or freshly opened,
 * and that is when a person's default organization decides where they land.
 */
export function hasTabOrg(): boolean {
  try {
    return Boolean(sessionStorage.getItem(TAB_KEY));
  } catch {
    return false;
  }
}

/**
 * The organization a link names (`?org=<slug>`, as in every notification
 * email), taken off the address so a reload or a copied URL does not keep
 * re-choosing it. Only names a choice: the API still checks membership, and a
 * slug the person cannot enter simply lands them at the picker.
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
