import { expect, test } from '../support/fixtures.js';

/**
 * No page may scroll sideways on a phone.
 *
 * This is asserted rather than eyeballed because the failure is easy to
 * reintroduce and hard to notice: one control with a fixed width in a row that
 * cannot wrap pushes the whole document wider, and every card on the page then
 * runs off the right edge.
 */
const PAGES = ['/', '/users', '/assignments', '/sessions', '/sessions?tab=finance', '/schedule', '/billing', '/comments', '/activity', '/profile'];

// iPhone-class width, and a narrow Android for good measure.
const WIDTHS = [390, 360];

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    for (const path of PAGES) {
      test(`${path} does not scroll sideways`, async ({ as }) => {
        const page = await as('admin');
        await page.setViewportSize({ width, height: 844 });
        await page.goto(path);

        // Wait for data, so the assertion covers rendered rows rather than
        // an empty shell.
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return doc.scrollWidth - doc.clientWidth;
        });

        expect(overflow, `${path} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
      });
    }
  });
}

// The dashboard's sessions carousel scrolls sideways inside itself; the page
// around it must not, for a tutor as much as for an admin.
for (const width of WIDTHS) {
  test(`a tutor's dashboard does not scroll sideways at ${width}px`, async ({ as }) => {
    const page = await as('tutor');
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, `overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  });
}

test('the users directory switches to cards on a phone', async ({ as }) => {
  const page = await as('admin');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/users');
  await page.waitForLoadState('networkidle');

  // The table is hidden below md; the same people appear as cards, with the
  // actions menu reachable rather than scrolled off to the right.
  await expect(page.locator('table')).toBeHidden();
  await expect(page.getByRole('button', { name: /Actions for/ }).first()).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('table')).toBeVisible();
});
