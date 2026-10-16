import { createContext, use } from 'react';

/**
 * How much room the live lesson banner takes at the bottom of the screen while it shows (0
 * otherwise), so a screen's last row can scroll clear of it. Provided by the `(org)` layout,
 * which mounts the banner; outside an organization there is none.
 */
export const LiveBannerInsetContext = createContext(0);

export function useLiveBannerInset(): number {
  return use(LiveBannerInsetContext);
}

/**
 * How far the tab bar reaches up over the foot of a screen above it: the hump that holds the "+"
 * (the tab bar, revised 2026-10-15), for a reader whose bar has one. Provided by the tabs layout,
 * so a sheet or a page outside the tabs gets 0.
 */
export const TabBarOverlapContext = createContext(0);

/**
 * The room a scrolling screen leaves at its foot for what floats over it: the live lesson banner
 * and the tab bar's hump. The last row scrolls clear of both.
 */
export function useBottomOverlap(): number {
  return use(LiveBannerInsetContext) + use(TabBarOverlapContext);
}
