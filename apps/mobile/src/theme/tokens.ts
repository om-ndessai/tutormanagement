/**
 * Spacing, radii and motion: the non-colour tokens. Colours live in the palette tokens
 * (`useAppTheme().tokens`), never here.
 */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;

/** Minimum touch target: 44pt (iOS HIG) is the stricter of 44pt / 48dp once density is applied. */
export const MIN_TARGET = 44;

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
