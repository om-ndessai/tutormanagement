/**
 * Colours that belong to artwork rather than to a palette: the amber the platform's mark carries
 * on the app icon and the sign-in screen (assets/source/icon.svg), and Google's own four, which
 * its branding requires unaltered in the "G".
 */
export const AIM_AMBER = '#F6B740';
/** The same amber, deepened to stay readable as text on a light background. */
export const AIM_AMBER_TEXT = '#D98E0E';

/** Text and spinners on the amber: dark in both themes, since the amber does not change. */
export const AIM_AMBER_INK = '#15252D';

export const GOOGLE_G = {
  red: '#EA4335',
  blue: '#4285F4',
  yellow: '#FBBC05',
  green: '#34A853',
  plate: '#FFFFFF',
} as const;

/**
 * The sign-in buttons' own colours, as each provider's branding asks: Google's white (or dark)
 * button, Microsoft's light and dark themes with its four squares, Facebook's blue with a white "f".
 * They are the providers' identities, so they do not follow the organization's palette.
 */
export const PROVIDER_BUTTONS = {
  google: {
    light: { background: '#FFFFFF', border: '#747775', text: '#1F1F1F' },
    dark: { background: '#131314', border: '#8E918F', text: '#E3E3E3' },
  },
  microsoft: {
    light: { background: '#FFFFFF', border: '#8C8C8C', text: '#5E5E5E' },
    dark: { background: '#2F2F2F', border: '#2F2F2F', text: '#FFFFFF' },
  },
  facebook: {
    light: { background: '#1877F2', border: '#1877F2', text: '#FFFFFF' },
    dark: { background: '#1877F2', border: '#1877F2', text: '#FFFFFF' },
  },
  apple: {
    light: { background: '#000000', border: '#000000', text: '#FFFFFF' },
    dark: { background: '#FFFFFF', border: '#FFFFFF', text: '#000000' },
  },
} as const;

/** Microsoft's four squares, in its own colours. */
export const MICROSOFT_SQUARES = { red: '#F25022', green: '#7FBA00', blue: '#00A4EF', yellow: '#FFB900' } as const;

/**
 * Phase 56: the share card's picture (apps/web/src/features/sharing/card-image.ts). An image, not the
 * app: its colours are the picture's own, fixed so it reads the same wherever it is posted.
 */
export const SHARE_CARD = {
  from: '#3b2a7a',
  to: '#6d4fd6',
  text: '#ffffff',
  right: '#22a06b',
  wrong: '#e5484d',
  skipped: '#d0d4dc',
} as const;
