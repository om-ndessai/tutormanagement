// The tab bar's hump (the tab bar, revised 2026-10-15: the owner's option B). A flat bar whose top
// edge rises in a semicircle at the centre to hold the "+", joined to the flat edge by small
// rounded shoulders. The mock-up drew it at 390pt wide with the flat top at y=40:
//   M0 40H144Q153 40 154.2 32A42 42 0 0 1 235.8 32Q237 40 246 40H390V130H0Z
// Here it is computed from the bar's real width, so the hump stays centred on every phone.
import { useAuth } from '@/providers/auth-provider';
import { TAB_BAR_HUMP } from '@/features/teaching/live-session';
import { createSetsOf, hasCreateActions } from './create-actions';

/** The hump's circle. */
export const HUMP_RADIUS = 42;
/** Half the hump's width at the flat edge, shoulders included (144 → 246 at 390pt). */
export const HUMP_HALF_WIDTH = 51;
/** Where the shoulder meets the arc: 40.8pt either side of the centre, 8pt above the flat edge. */
const ARC_HALF_CHORD = 40.8;
const SHOULDER_RISE = 8;
/** The shoulder's control point, 42pt either side of the centre on the flat edge. */
const SHOULDER_CONTROL = 42;

/** The "+" disc, centred in the hump. */
export const CREATE_DISC = 56;

/**
 * Where the disc's centre sits below the flat edge: the hump circle's own centre, which is
 * `sqrt(42² - 40.8²) - 8` ≈ 2pt below it (y≈42 in the mock-up's frame).
 */
export const DISC_CENTRE_BELOW_EDGE =
  Math.sqrt(HUMP_RADIUS ** 2 - ARC_HALF_CHORD ** 2) - SHOULDER_RISE;

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * The top edge alone, hump and shoulders, for the hairline and the shadow: from the left edge to
 * the right, at `edge` (the flat top's y in the drawing's frame).
 */
export function humpEdgePath(width: number, edge: number = TAB_BAR_HUMP): string {
  const centre = width / 2;
  const x = (offset: number) => round(centre + offset);
  const y = round(edge);
  const shoulder = round(edge - SHOULDER_RISE);
  return (
    `M0 ${y}` +
    `H${x(-HUMP_HALF_WIDTH)}` +
    `Q${x(-SHOULDER_CONTROL)} ${y} ${x(-ARC_HALF_CHORD)} ${shoulder}` +
    `A${HUMP_RADIUS} ${HUMP_RADIUS} 0 0 1 ${x(ARC_HALF_CHORD)} ${shoulder}` +
    `Q${x(SHOULDER_CONTROL)} ${y} ${x(HUMP_HALF_WIDTH)} ${y}` +
    `H${round(width)}`
  );
}

/** The bar's whole fill: the top edge, then down the right side, along the foot and back up. */
export function humpFillPath(width: number, height: number, edge: number = TAB_BAR_HUMP): string {
  return `${humpEdgePath(width, edge)}V${round(height)}H0Z`;
}

/** Whether the reader's bar has a "+", and so the hump: anyone with something to create. */
export function useTabBarHump(): boolean {
  const { user, organization } = useAuth();
  return hasCreateActions(user?.roles, createSetsOf(organization));
}
