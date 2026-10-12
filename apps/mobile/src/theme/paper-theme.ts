import type { OrgPalette } from '@tmi/shared';
import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { PALETTE_TOKENS } from './palettes.generated';

export type ColorScheme = 'light' | 'dark';
type Generated = (typeof PALETTE_TOKENS)[OrgPalette][ColorScheme];

/**
 * Every colour a component may use: the web app's semantic tokens (the same names, camelCased:
 * `primary`, `mutedForeground`, `border`, `rating3`, `brand100` ...) for one palette and scheme.
 * Components read these through `useAppTheme().tokens`, never a literal.
 */
export type Tokens = { [K in keyof Generated]: string } & {
  /** Present on the palettes that define an answering accent hue (indigo). */
  accentTeal400?: string;
};

export type AppTheme = MD3Theme & { tokens: Tokens; palette: OrgPalette; scheme: ColorScheme };

/** Mix a hex colour toward another (for elevation tints); `amount` 0..1. */
function mix(base: string, over: string, amount: number): string {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const a = parse(base);
  const b = parse(over);
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round(v + ((b[i] ?? v) - v) * amount)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

/**
 * A Paper (Material 3) theme built from one organization's palette, so Paper's own components
 * (buttons, inputs, chips, the app bar) wear the organization's colours with no per-component
 * styling. Mapping, web token → MD3 role:
 *
 *   primary / primaryForeground       → primary / onPrimary
 *   brand-100 (dark: brand-900)       → primaryContainer
 *   secondary / secondaryForeground   → secondaryContainer / onSecondaryContainer
 *   accent / accentForeground         → tertiaryContainer / onTertiaryContainer
 *   background / foreground           → background / onBackground
 *   card / cardForeground             → surface / onSurface
 *   muted / mutedForeground           → surfaceVariant / onSurfaceVariant
 *   border                            → outline, outlineVariant
 *   destructive                       → error
 */
export function buildTheme(palette: OrgPalette, scheme: ColorScheme): AppTheme {
  const t = PALETTE_TOKENS[palette][scheme] as Tokens;
  const dark = scheme === 'dark';
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  // Borders in dark mode are translucent white (#FFFFFF1F); Paper wants opaque outlines.
  const outline = t.border.length > 7 ? mix(t.card, '#FFFFFF', 0.14) : t.border;
  const surfaceTint = t.primary;

  return {
    ...base,
    dark,
    roundness: 3,
    palette,
    scheme,
    tokens: t,
    colors: {
      ...base.colors,
      primary: t.primary,
      onPrimary: t.primaryForeground,
      primaryContainer: dark ? t.brand900 : t.brand100,
      onPrimaryContainer: dark ? t.brand100 : t.brand900,
      secondary: t.secondaryForeground,
      onSecondary: t.secondary,
      secondaryContainer: t.secondary,
      onSecondaryContainer: t.secondaryForeground,
      tertiary: t.accentForeground,
      onTertiary: t.accent,
      tertiaryContainer: t.accent,
      onTertiaryContainer: t.accentForeground,
      background: t.background,
      onBackground: t.foreground,
      surface: t.card,
      onSurface: t.cardForeground,
      surfaceVariant: t.muted,
      onSurfaceVariant: t.mutedForeground,
      outline,
      outlineVariant: outline,
      error: t.destructive,
      onError: t.destructiveForeground,
      errorContainer: mix(t.card, t.destructive, dark ? 0.25 : 0.12),
      onErrorContainer: t.destructive,
      inverseSurface: t.foreground,
      inverseOnSurface: t.background,
      inversePrimary: dark ? t.brand700 : t.brand300,
      elevation: {
        level0: 'transparent',
        level1: mix(t.card, surfaceTint, 0.05),
        level2: mix(t.card, surfaceTint, 0.08),
        level3: mix(t.card, surfaceTint, 0.11),
        level4: mix(t.card, surfaceTint, 0.12),
        level5: mix(t.card, surfaceTint, 0.14),
      },
    },
  };
}
