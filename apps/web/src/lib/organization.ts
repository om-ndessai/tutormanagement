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
