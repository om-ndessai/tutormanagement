import { Platform } from 'react-native';

/**
 * Spacing, radii and motion: the non-colour tokens. Colours live in the palette tokens
 * (`useAppTheme().tokens`), never here.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

/** Minimum touch target: 44pt (iOS HIG) is the stricter of 44pt / 48dp once density is applied. */
export const MIN_TARGET = 44;

/**
 * A Paper chip is 32pt tall: its slop brings the touch height to 44pt (iOS) / 48dp (Android)
 * without making the chip look bigger (ux-audit F-5). Rows of chips leave room for it.
 */
export const CHIP_HIT_SLOP =
  Platform.OS === 'android'
    ? ({ top: 8, bottom: 8, left: 0, right: 0 } as const)
    : ({ top: 6, bottom: 6, left: 0, right: 0 } as const);

/**
 * Spring and timing tokens (docs/mobile/immersive-design.md, "Motion"). Starting points after
 * Material 3 Expressive's spatial springs; every use is stilled by reduce motion.
 */
export const motion = {
  spring: { damping: 18, stiffness: 380, mass: 1 },
  springGentle: { damping: 22, stiffness: 220, mass: 1 },
  fast: 150,
  medium: 250,
  slow: 400,
} as const;
