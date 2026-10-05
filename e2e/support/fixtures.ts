import { test as base, type Page } from '@playwright/test';
import { ORGS, PEOPLE, type PersonKey } from './people.js';

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
  /**
   * The organization the browser is in: a slug, or null for none chosen (the
   * picker, the platform console). Organization A by default, which is where
   * the whole cast has always lived.
   */
  org?: string | null;
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

      // The organization travels the way a returning browser's does: the
      // remembered-choice cookie, which the page reads and turns into its
      // X-Organization header. A context header instead would double up with
      // the page's own. With sign-in off the API also honours the cookie, so
      // page.request calls run in the same organization.
      const org = options.org === undefined ? ORGS.a.slug : options.org;
      if (org) {
        await context.addCookies([
          { name: 'tmi_last_org', value: org, url: test.info().project.use.baseURL! },
        ]);
      }
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
export { ORGS, PEOPLE };
