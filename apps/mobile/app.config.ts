import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One app, three variants, chosen by APP_VARIANT at build time:
 *
 * - development (default): dev client, Metro, developer sign-in, the (dev) screens.
 * - e2e: a Release bundle the Maestro flows drive; developer sign-in and the sign-in deep
 *   link stay, LogBox is off, motion is reduced.
 * - production: no developer sign-in and no (dev) screens; Google sign-in (Phase 4).
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
    // iOS 27 requires the scene life cycle; see the plugin.
    './plugins/with-scene-lifecycle.js',
    ...(variant === 'development' ? ['./plugins/with-quiet-dev-menu.js'] : []),
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    variant,
    // Phase 4 fills these from the environment; see .env.example and docs/mobile/google-sign-in.md.
    productionApiUrl: process.env.EXPO_PUBLIC_PRODUCTION_API_URL ?? null,
  },
});
