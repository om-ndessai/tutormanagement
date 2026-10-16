// The colours of a chosen reflection face (UI upgrades U4), from the theme's tokens only. Kept apart
// from the sheet so the symmetry of the centred scales is tested without rendering it.
import type { Rating } from '@tmi/shared';

import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import type { FaceTone } from './reflection-faces';

export interface FaceColours {
  fill: string;
  ink: string;
  border: string;
}

/**
 * Where more is better, the rating ramp every other 1-5 score uses. On a centred scale (difficulty,
 * pace), by distance from "About right": the warm highlight for right, the quiet muted surface a
 * step either way, the warning tint at either end -- the same both sides, never darker for a
 * higher value.
 */
export function faceColours(theme: AppTheme, tone: FaceTone): FaceColours {
  const t = theme.tokens;
  const warningInk = theme.scheme === 'dark' ? t.warning : t.warningForeground;
  switch (tone) {
    case 'right':
      return { fill: t.highlightSoft, ink: t.highlightSoftForeground, border: t.highlight };
    case 'near':
      return { fill: t.muted, ink: theme.colors.onSurface, border: theme.colors.outline };
    case 'far':
      return { fill: withAlpha(t.warning, 0.18), ink: warningInk, border: withAlpha(t.warning, 0.6) };
    default: {
      const value = Number(tone.slice('rating'.length)) as Rating;
      const fills = [t.rating1, t.rating2, t.rating3, t.rating4, t.rating5] as const;
      const inks = [t.rating1Ink, t.rating2Ink, t.rating3Ink, t.rating4Ink, t.rating5Ink] as const;
      return { fill: fills[value - 1]!, ink: inks[value - 1]!, border: fills[value - 1]! };
    }
  }
}
