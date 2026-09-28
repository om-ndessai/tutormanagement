import { test as base, type Page } from '@playwright/test';
import { PEOPLE, type PersonKey } from './people.js';

/**
 * Signing in is not possible unattended -- Google owns that flow -- so the
 * suite runs against a deployment with AUTH_ENABLED=false and names the user
 * it wants per request.
 *
 * The header is honoured only while auth is off, so this cannot be used to
 * impersonate anyone on a live, secured deployment.
 */
/**
 * A browser the welcome wizard (Phase 26) has already been shown in. Every
 * seeded person has been through the wizard, so with this cookie too they
 * meet neither it nor its "new here on this device?" offer -- which would
 * otherwise sit over the page in every spec. Set before the page's own
 * scripts run, on every navigation.
 */
function markTourSeen() {
  document.cookie = 'tmi_tour_seen=1; path=/';
}

export interface AsOptions {
  /** A browser that has never shown the wizard: no tour cookie. */
  fresh?: boolean;
  /** Act as this address rather than a seeded persona's. */
  email?: string;
}

export const test = base.extend<{
  as: (who: PersonKey, options?: AsOptions) => Promise<Page>;
}>({
  as: async ({ browser }, use) => {
    const pages: Page[] = [];

    await use(async (who: PersonKey, options: AsOptions = {}) => {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'X-Dev-User': options.email ?? PEOPLE[who].email },
      });
      if (!options.fresh) await context.addInitScript(markTourSeen);
      const page = await context.newPage();
      pages.push(page);
      return page;
    });

    for (const page of pages) {
      await page.context().close();
    }
  },
});

export { expect } from '@playwright/test';
export { PEOPLE };
