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
/*
 * The welcome wizard (Phase 26) opens once per PERSON, decided by the server alone since Phase 74 (JF25): every
 * seeded person has been through it, so no spec's browser meets it or an offer of it, and no browser is different --
 * the old `tmi_tour_seen` cookie is no longer set here, nor read by the app.
 */

/**
 * A tab that has already had its sign-in landing (Phase 42: Question Quest
 * sends a student with a question waiting, and a tutor with answers waiting,
 * straight into it, once per tab). Set so no other spec is taken there.
 */
function markQuestLanded() {
  try {
    sessionStorage.setItem('aimtrue.quest-landed', '1');
  } catch {
    // Storage blocked: the landing reads the same, and lands.
  }
}

/** The tab's own space (sessionStorage `tmi_org`), set once per tab so a switch is kept. */
function markTabOrg(slug: string) {
  try {
    if (!sessionStorage.getItem('tmi_org')) sessionStorage.setItem('tmi_org', slug);
  } catch {
    // Storage blocked: the tab arrives, and lands by the rule.
  }
}

export interface AsOptions {
  /**
   * A browser that has never shown the wizard. Since Phase 74 the server alone decides (JF25), so this marks the
   * specs that meet the wizard and changes nothing about the browser.
   */
  fresh?: boolean;
  /** Let Question Quest's sign-in landing happen (Phase 42); off in every other spec. */
  questLanding?: boolean;
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
      if (!options.questLanding) await context.addInitScript(markQuestLanded);

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
        // Phase 60: a tab ARRIVING with no space of its own lands by the person's last choice on
        // the server, which every spec's entering moves. A tab already in a space keeps it, so
        // each new tab here starts in `org` as its own (until it switches); `org: null` is the
        // arriving tab, which lands by the rule.
        await context.addInitScript(markTabOrg, org);
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
