import type { Locator, Page } from '@playwright/test';

/**
 * Matches text in whichever layout is currently rendered.
 *
 * Several screens ship a phone layout and a desktop one, only one of which is
 * visible at a given width -- but both are in the DOM. A bare getByText then
 * matches twice (strict-mode violation), and `.first()` can pick the hidden
 * one. Filtering to the visible element says what the test actually means:
 * "the name, as the user sees it".
 */
export function visible(page: Page, text: string | RegExp): Locator {
  return page.getByText(text).filter({ visible: true });
}
