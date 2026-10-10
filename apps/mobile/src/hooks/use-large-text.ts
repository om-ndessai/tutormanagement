import { useWindowDimensions } from 'react-native';

/**
 * The font scale from which the layouts adapt (ux-audit F-12): iOS's accessibility sizes and
 * Android's largest steps. Below it the phone layouts hold as designed; from it, rows stack, grids
 * go to one column and page intros fold away.
 */
export const LARGE_TEXT_SCALE = 1.35;

/** Icons grow with the text, but not without limit: past this they crowd out the words. */
export const ICON_SCALE_CAP = 1.6;

export function isLargeText(fontScale: number): boolean {
  return fontScale >= LARGE_TEXT_SCALE;
}

/** True while the reader's text size is large enough that the layouts adapt to it. */
export function useLargeText(): boolean {
  return isLargeText(useWindowDimensions().fontScale);
}

/** An icon size that follows the text size, capped (`size * min(fontScale, 1.6)`). */
export function scaledIconSize(size: number, fontScale: number): number {
  return Math.round(size * Math.min(Math.max(fontScale, 1), ICON_SCALE_CAP));
}

export function useIconSize(size: number): number {
  return scaledIconSize(size, useWindowDimensions().fontScale);
}

/**
 * How many lines a label normally kept to `base` may take. Truncating a name or a label at the
 * largest sizes leaves a fragment ("Sofi…", "SESS…"), so under large text it wraps instead.
 */
export function useLines(base: number): number | undefined {
  return useLargeText() ? undefined : base;
}

/**
 * The same for a component whose own default is a line count, not "unlimited" -- Paper's
 * List.Item treats a missing `titleNumberOfLines` as 1.
 */
export function useLineLimit(base: number): number {
  return useLargeText() ? Math.max(base * 3, 4) : base;
}
