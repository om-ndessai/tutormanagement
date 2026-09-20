import { defineConfig, devices } from '@playwright/test';

/**
 * Per docs/plan.md, the suite drives the DEPLOYED portal rather than a local
 * dev server: the bugs this project has actually hit -- a stale production
 * schema, dev-mode CORS shipped to production -- only exist once something is
 * deployed, and a local run would never see them.
 *
 * `npm run e2e` from the repo root wipes and rebuilds the remote database,
 * deploys with authentication off, runs this suite, then restores auth.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'https://tmi-portal.om-ndessai.workers.dev';

export default defineConfig({
  testDir: './tests',
  // Every spec assumes the seeded roster. Running them in parallel against one
  // shared remote database would have them writing over each other.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Uses the Chrome already installed rather than downloading a browser.
        // Override with PLAYWRIGHT_CHANNEL= to use Playwright's own build.
        ...(process.env.PLAYWRIGHT_CHANNEL === '' ? {} : { channel: 'chrome' }),
      },
    },
  ],
});
