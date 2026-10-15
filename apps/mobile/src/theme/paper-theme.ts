import type { OrgPalette } from '@tmi/shared';
import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';

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

/**
 * Headings in Nunito (UI upgrades U1): rounded and friendly, where the body stays the system font
 * for reading. Loaded in the root layout before the splash hides (`HEADING_FONTS`). A face per
 * weight, with fontWeight left normal: Android fakes a bold over a named face otherwise.
 */
export const HEADING_FONT = { heavy: 'Nunito_800ExtraBold', bold: 'Nunito_700Bold' } as const;
const heading = (fontFamily: string) => ({ fontFamily, fontWeight: 'normal' as const });
const FONTS = configureFonts({
  config: {
    displayLarge: heading(HEADING_FONT.heavy),
    displayMedium: heading(HEADING_FONT.heavy),
    displaySmall: heading(HEADING_FONT.heavy),
    headlineLarge: heading(HEADING_FONT.heavy),
    headlineMedium: heading(HEADING_FONT.heavy),
    headlineSmall: heading(HEADING_FONT.heavy),
    titleLarge: heading(HEADING_FONT.heavy),
    titleMedium: heading(HEADING_FONT.bold),
    // Nothing under 12pt (UI upgrades U1): Material's smallest label is 11.
    labelSmall: { fontSize: 12, lineHeight: 16 },
  },
});

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
  // Borders in dark mode are translucent white (#FFFFFF1F); Paper wants opaque outlines. A control's
  // edge (Paper's `outline`: inputs, outlined buttons and chips) takes the stronger --input, at
  // least 3:1 on the page; dividers and card edges (`outlineVariant`) stay soft on --border.
  const outline = t.input.length > 7 ? mix(t.card, '#FFFFFF', 0.3) : t.input;
  const divider = t.border.length > 7 ? mix(t.card, '#FFFFFF', 0.14) : t.border;
  const surfaceTint = t.primary;

  return {
    ...base,
    dark,
    roundness: 3,
    fonts: FONTS,
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
      outlineVariant: divider,
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
