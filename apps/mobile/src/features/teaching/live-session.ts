// Ported from apps/web/src/features/teaching/live-session-bar.tsx @ 1132322 (the stop toast, the
// "from" and "ends by" badges) -- pure, so the banner and the tests share them.
import { formatClockTime, formatDuration, type ActiveSession, type TutoringSession } from '@tmi/shared';

import { formatInstantClock } from './session-format';

/**
 * What the banner says about the lesson's clock: the start it will be recorded from (the server
 * has already snapped it to a quarter hour) and the instant it closes itself at the limit, on the
 * organization's clock -- never the device's, never UTC.
 */
export function liveTimes(
  active: Pick<ActiveSession, 'rounded_start' | 'auto_stop_at'>,
  timeZone: string,
): { from: string; endsBy: string } {
  return {
    from: formatClockTime(active.rounded_start),
    endsBy: formatInstantClock(active.auto_stop_at, timeZone),
  };
}

/**
 * Said with the student beside the tutor, so the times and the length and never the money
 * (Phase 19): the amount is on the Sessions Finance tab.
 */
export function stopToast(
  session: Pick<TutoringSession, 'started_at' | 'ended_at' | 'duration_minutes'>,
): string {
  return (
    `Session recorded: ${formatClockTime(session.started_at)}–` +
    `${formatClockTime(session.ended_at)}, ${formatDuration(session.duration_minutes)}.`
  );
}

/**
 * The height of the tab bar above the bottom safe-area inset. The app draws the bar
 * (`features/shell/app-tab-bar.tsx`, UI upgrades U2) at exactly this height: a 56pt bar on iOS,
 * Material 3's 80dp navigation bar on Android.
 */
export const TAB_BAR_ABOVE_INSET = { ios: 56, android: 80 } as const;

/**
 * How far the hump that holds the "+" rises above the flat bar (the tab bar, revised 2026-10-15).
 * Only a bar with a "+" has it; a reader with nothing to create keeps a flat bar.
 */
export const TAB_BAR_HUMP = 40;

/** How much of the window's foot the tab bar takes above the inset, hump included when it has one. */
export function tabBarClearance(platform: 'ios' | 'android', hump: boolean): number {
  return TAB_BAR_ABOVE_INSET[platform] + (hump ? TAB_BAR_HUMP : 0);
}

/** The gap between the banner and whatever it floats above. */
export const BANNER_GAP = 8;

/** The banner's height: two lines and a 44pt button row. */
export const BANNER_HEIGHT = 64;

/**
 * How far the banner sits above the bottom edge: clear of the tab bar on a tab -- and of its hump,
 * when the bar has a "+" -- else of the inset.
 */
export function bannerBottom(
  platform: 'ios' | 'android',
  insetBottom: number,
  onTab: boolean,
  hump = false,
): number {
  return insetBottom + (onTab ? tabBarClearance(platform, hump) : 0) + BANNER_GAP;
}
