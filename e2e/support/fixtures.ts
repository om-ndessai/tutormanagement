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
export const test = base.extend<{ as: (who: PersonKey) => Promise<Page> }>({
  as: async ({ browser }, use) => {
    const pages: Page[] = [];

    await use(async (who: PersonKey) => {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'X-Dev-User': PEOPLE[who].email },
      });
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
