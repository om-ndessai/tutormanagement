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
