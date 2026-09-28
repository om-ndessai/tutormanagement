import { TOUR_COOKIE } from '@tmi/shared';

/**
 * Whether THIS browser has shown the welcome wizard or its offer (Phase 26).
 * The database remembers the person; this remembers the device. Wrapped, as
 * any storage is: a browser that refuses cookies simply gets the offer again.
 */
export function hasTourCookie(): boolean {
  try {
    return document.cookie.split('; ').some((part) => part.startsWith(`${TOUR_COOKIE}=`));
  } catch {
    return false;
  }
}

/** A year, site-wide, readable by the page itself; it holds nothing but "seen". */
export function setTourCookie(): void {
  try {
    document.cookie = `${TOUR_COOKIE}=1; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`;
  } catch {
    // Nothing to do: the offer will simply come back on this browser.
  }
}
