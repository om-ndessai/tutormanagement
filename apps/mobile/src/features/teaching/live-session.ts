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
 * The height of the system tab bar above the bottom safe-area inset. `NativeTabs` does not report
 * it, so it is the platform's: iOS 26+'s floating glass bar, Android's Material 3 navigation bar.
 */
export const TAB_BAR_ABOVE_INSET = { ios: 48, android: 80 } as const;

/** The gap between the banner and whatever it floats above. */
export const BANNER_GAP = 8;

/** How far the banner sits above the bottom edge: clear of the tab bar on a tab, else of the inset. */
export function bannerBottom(platform: 'ios' | 'android', insetBottom: number, onTab: boolean): number {
  return insetBottom + (onTab ? TAB_BAR_ABOVE_INSET[platform] : 0) + BANNER_GAP;
}
