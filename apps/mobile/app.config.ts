import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One app, three variants, chosen by APP_VARIANT at build time:
 *
 * - development (default): dev client, Metro, developer sign-in, the (dev) screens.
 * - e2e: a Release bundle the Maestro flows drive; developer sign-in and the sign-in deep
 *   link stay, LogBox is off, motion is reduced.
 * - production: no developer sign-in and no (dev) screens; Google sign-in only.
 *
 * Each variant has its own bundle id, so all three can sit on one device. The name is the
 * platform's ("Tutor Portal"): the app is not any one organization's, and wears an
 * organization's brand only once one is chosen.
 */
type Variant = 'development' | 'e2e' | 'production';

const variant = (process.env.APP_VARIANT ?? 'development') as Variant;
const BASE_ID = 'com.tutorportal.app';
const SUFFIX: Record<Variant, string> = { development: '.dev', e2e: '.e2e', production: '' };
const NAME: Record<Variant, string> = {
  development: 'Tutor Portal (dev)',
  e2e: 'Tutor Portal (e2e)',
  production: 'Tutor Portal',
};
// The platform palette's primary (ORG_PALETTE_HEX.platform): the splash is shown before any
// organization is known, so it wears the platform's colour.
const PLATFORM_PRIMARY = '#30577D';

/**
 * Google sign-in (docs/mobile/google-sign-in.md). Values come from the environment (see
 * .env.example); only the portal's public web client ID has a default.
 *
 * - The iOS client ID is per bundle id, so per variant; the e2e build signs in through the
 *   developer sign-in and has none. Its reversed form is the URL scheme Google returns to.
 * - With no iOS client ID the plugin is left out entirely (without options it expects Firebase
 *   files and fails the prebuild), and the app hides the Google button on iOS.
 * - The web client ID is read from the server's /api/auth/config at runtime; this is the fallback.
 */
const GOOGLE_IOS_CLIENT_ID: Record<Variant, string | undefined> = {
  development: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_DEV,
  e2e: undefined,
  production: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
};
const googleIosClientId = GOOGLE_IOS_CLIENT_ID[variant]?.trim() || null;
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ||
  '866980945062-aoh0gotj6fld07cd9gtkeo7p0hdu9gsa.apps.googleusercontent.com';

/** `123-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.123-abc`. */
function reversedClientId(clientId: string): string {
  return clientId.split('.').reverse().join('.');
}

// The multi-organization address, never `tmi-portal` (which lands everyone in one organization).
const PRODUCTION_API_URL =
  process.env.EXPO_PUBLIC_PRODUCTION_API_URL?.trim() || 'https://tutoring.om-ndessai.workers.dev';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME[variant],
  slug: 'tutor-portal',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'tutorportal',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BASE_ID + SUFFIX[variant],
    supportsTablet: true,
    icon: './assets/expo.icon',
    infoPlist: {
      // The local Worker is plain http on localhost; ATS allows local networking only.
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: (BASE_ID + SUFFIX[variant]).replace(/-/g, '_'),
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // Off: react-native-screens has no predictive-back support yet (docs/mobile/immersive-design.md).
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: PLATFORM_PRIMARY, image: './assets/images/splash-icon.png', imageWidth: 76 },
    ],
    'expo-secure-store',
    'expo-sharing',
    'expo-localization',
    // The console's logo upload (#35) uses the system photo picker. Neutral copy: the app is nobody's.
    [
      'expo-image-picker',
      { photosPermission: 'Allow $(PRODUCT_NAME) to choose a picture from your photo library.' },
    ],
    // iOS 27 requires the scene life cycle; see the plugin.
    './plugins/with-scene-lifecycle.js',
    ...(variant === 'development' ? ['./plugins/with-quiet-dev-menu.js'] : []),
    ...(googleIosClientId
      ? [
          [
            '@react-native-google-signin/google-signin',
            { iosUrlScheme: reversedClientId(googleIosClientId) },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    variant,
    productionApiUrl: PRODUCTION_API_URL,
    // Left out when absent: a null here reaches the app's manifest as {}.
    ...(googleIosClientId ? { googleIosClientId } : {}),
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
  },
});
