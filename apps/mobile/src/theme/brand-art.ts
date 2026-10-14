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
