// Where a toast sits (ux-audit F-2): above the tab bar on a tab, above the live lesson banner while
// it shows, and just above the home indicator anywhere else (a pushed page, a sheet). A toast over
// the tab bar hid the labels and took the next tap meant for a tab.
import { TAB_BAR_ABOVE_INSET } from '@/features/teaching/live-session';

export interface ToastPlacement {
  /** The screen in front is a tab root or a page inside a tab's stack: the tab bar shows. */
  onTab: boolean;
  /** The room the live lesson banner takes (0 when it is not showing). */
  bannerInset: number;
}

export const NO_PLACEMENT: ToastPlacement = { onTab: false, bannerInset: 0 };

/** The gap between a toast and whatever it floats above. */
export const TOAST_GAP = 8;

/** The toast's distance from the bottom edge of the window. */
export function toastBottom(
  platform: 'ios' | 'android',
  insetBottom: number,
  { onTab, bannerInset }: ToastPlacement,
): number {
  const tabBar = onTab ? TAB_BAR_ABOVE_INSET[platform] : 0;
  // The banner's inset is its height plus the gap beneath it.
  return insetBottom + tabBar + bannerInset + TOAST_GAP;
}
