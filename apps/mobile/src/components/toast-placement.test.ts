// A toast clears the tab bar on a tab and the live banner while it shows (ux-audit F-2).
import { BANNER_GAP, BANNER_HEIGHT, TAB_BAR_ABOVE_INSET } from '@/features/teaching/live-session';
import { NO_PLACEMENT, TOAST_GAP, toastBottom } from './toast-placement';

const INSET = 34;
const BANNER = BANNER_HEIGHT + BANNER_GAP;

test.each(['ios', 'android'] as const)('%s: on a tab the toast sits above the tab bar', (platform) => {
  const bottom = toastBottom(platform, INSET, { onTab: true, bannerInset: 0 });
  expect(bottom).toBeGreaterThanOrEqual(INSET + TAB_BAR_ABOVE_INSET[platform] + TOAST_GAP);
});

test.each(['ios', 'android'] as const)(
  '%s: with the live banner it sits above the banner too',
  (platform) => {
    const bannerTop = INSET + TAB_BAR_ABOVE_INSET[platform] + BANNER_GAP + BANNER_HEIGHT;
    expect(toastBottom(platform, INSET, { onTab: true, bannerInset: BANNER })).toBeGreaterThan(bannerTop);
    // Off a tab (a pushed page), the banner sits on the inset, and the toast above it.
    expect(toastBottom(platform, INSET, { onTab: false, bannerInset: BANNER })).toBeGreaterThan(
      INSET + BANNER_GAP + BANNER_HEIGHT,
    );
  },
);

test('over a sheet or a pushed page it sits just above the home indicator', () => {
  expect(toastBottom('ios', INSET, NO_PLACEMENT)).toBe(INSET + TOAST_GAP);
});
