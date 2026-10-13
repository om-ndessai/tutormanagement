import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One app, three variants, chosen by APP_VARIANT at build time:
 *
 * - development (default): dev client, Metro, developer sign-in, the (dev) screens.
 * - e2e: a Release bundle the Maestro flows drive; developer sign-in and the sign-in deep
 *   link stay, LogBox is off, motion is reduced.
 * - production: no developer sign-in and no (dev) screens; Google sign-in only.
 * - personal: production, signed by a free Apple ID ("Personal Team") for the owner's own iPhones
 *   (docs/mobile/real-devices.md). The app runs as production; the build has its own bundle id,
 *   so the free team never claims the real one, and leaves out the Live Activity extension, whose
 *   App Group and push entitlement a free team cannot sign.
 *
 * Each variant has its own bundle id, so all three can sit on one device. The name is the
 * platform's ("Aimtrue"): the app is not any one organization's, and wears an
 * organization's brand only once one is chosen.
 */
type Variant = 'development' | 'e2e' | 'production' | 'personal';

const variant = (process.env.APP_VARIANT ?? 'development') as Variant;
const BASE_ID = 'com.aimtrue.app';
const SUFFIX: Record<Variant, string> = {
  development: '.dev',
  e2e: '.e2e',
  production: '',
  personal: '.personal',
};
/** What the app itself sees: the personal build is production in every way that matters at runtime. */
const RUNTIME_VARIANT = variant === 'personal' ? 'production' : variant;
const productionLike = RUNTIME_VARIANT === 'production';
const NAME: Record<Variant, string> = {
  development: 'Aimtrue (dev)',
  e2e: 'Aimtrue (e2e)',
  production: 'Aimtrue',
  personal: 'Aimtrue',
};
// The platform palette's primary (ORG_PALETTE_HEX.platform): the icon and the splash are shown
// before any organization is known, so they wear the platform's colour. The art in assets/ carries
// the same value (assets/source/*.svg, rendered by scripts/render-icons.sh); this config cannot
// import src/theme, so it is restated here and nowhere else outside the theme.
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
  personal: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID_PERSONAL,
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

/**
 * App Transport Security: plain http to this Mac's Worker is allowed (local networking only) in
 * the development and e2e builds, and in a production build only when it was pointed at the local
 * Worker for the Release check (docs/mobile/setup.md). A real production build talks HTTPS only and
 * carries no exception.
 */
const LOCAL_HTTP = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/;
const allowsLocalNetworking = !productionLike || LOCAL_HTTP.test(PRODUCTION_API_URL);

/** The Apple team that signs device builds (the owner's Personal Team for the personal build). */
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID?.trim() || undefined;

/**
 * iOS privacy manifest (PrivacyInfo.xcprivacy). No tracking, no tracking domains.
 *
 * Collected: what the app sends to and shows from the organization's server, all linked to the
 * signed-in person and used for the app's own function only -- people's names, emails, phones and
 * (a tutor's, for the 1099) mailing address; their account ids; lesson notes, write-ups,
 * assessments, reflections and comments (other user content); lesson pay, charges and payments
 * (other financial info); and the picture an organization's admin uploads as its logo.
 *
 * Required-reason APIs, restated at the app level because Apple does not always read the manifests
 * of static pods (docs.expo.dev/guides/apple-privacy): UserDefaults CA92.1 (React Native,
 * expo-constants, expo-localization, expo-system-ui, GoogleSignIn), file timestamps C617.1 (React
 * Native, AsyncStorage, folly/glog/boost, expo-file-system), system boot time 35F9.1 (React Native
 * timing, boost), disk space E174.1 (expo-file-system, which writes the CSV/ICS downloads and the
 * logo before upload). SDK-wrapper reasons (C56D.1, 0A2A.1) stay in those SDKs' own manifests.
 */
const collected = (type: string) => ({
  NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${type}`,
  NSPrivacyCollectedDataTypeLinked: true,
  NSPrivacyCollectedDataTypeTracking: false,
  NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
});
const PRIVACY_MANIFEST = {
  NSPrivacyTracking: false,
  NSPrivacyTrackingDomains: [],
  NSPrivacyCollectedDataTypes: [
    'Name',
    'EmailAddress',
    'PhoneNumber',
    'PhysicalAddress',
    'UserID',
    'OtherUserContent',
    'OtherFinancialInfo',
    'PhotosorVideos',
  ].map(collected),
  NSPrivacyAccessedAPITypes: (
    [
      ['UserDefaults', 'CA92.1'],
      ['FileTimestamp', 'C617.1'],
      ['SystemBootTime', '35F9.1'],
      ['DiskSpace', 'E174.1'],
    ] as const
  ).map(([category, reason]) => ({
    NSPrivacyAccessedAPIType: `NSPrivacyAccessedAPICategory${category}`,
    NSPrivacyAccessedAPITypeReasons: [reason],
  })),
};

/** Dictation's permission copy (P3): neutral, and true on every path (the audio is never kept). */
const MICROPHONE_COPY =
  'Used only while you dictate lesson notes. What you say is turned into text and the audio is never kept.';
const SPEECH_COPY = 'Turns what you say into text when you dictate lesson notes.';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME[variant],
  slug: 'aimtrue',
  // The version testers and the store see; the build number is EAS's (eas.json, remote).
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'aimtrue',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: BASE_ID + SUFFIX[variant],
    ...(APPLE_TEAM_ID ? { appleTeamId: APPLE_TEAM_ID } : {}),
    supportsTablet: true,
    // Icon Composer (iOS 26+: Liquid Glass, with the system's dark, clear and tinted looks);
    // Xcode renders the flat icon for older iOS from it. Source: assets/source/aimtrue-mark.svg.
    icon: './assets/Aimtrue.icon',
    // HTTPS only: ITSAppUsesNonExemptEncryption = false, so no export-compliance question per build.
    config: { usesNonExemptEncryption: false },
    privacyManifests: PRIVACY_MANIFEST,
    infoPlist: {
      // The short name iOS uses where the display name is not, e.g. Google's "… Wants to Use
      // google.com to Sign In" prompt; left alone it is the sanitised product name ("Aimtruedev").
      CFBundleName: NAME[variant],
      // Replaces the template's whole ATS dictionary (which allows local networking everywhere).
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        ...(allowsLocalNetworking ? { NSAllowsLocalNetworking: true } : {}),
      },
    },
  },
  android: {
    package: (BASE_ID + SUFFIX[variant]).replace(/-/g, '_'),
    adaptiveIcon: {
      backgroundColor: PLATFORM_PRIMARY,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // Off: react-native-screens has no predictive-back support yet (docs/mobile/immersive-design.md).
    predictiveBackGestureEnabled: false,
    // "Add to calendar" opens the calendar app's own editor (an ACTION_INSERT intent), which needs
    // no permission; expo-calendar's plugin would ask for both.
    blockedPermissions: ['android.permission.READ_CALENDAR', 'android.permission.WRITE_CALENDAR'],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { backgroundColor: PLATFORM_PRIMARY, image: './assets/images/splash-icon.png', imageWidth: 112 },
    ],
    // No biometrics: false drops the plugin's default Face ID usage string.
    ['expo-secure-store', { faceIDPermission: false }],
    'expo-sharing',
    'expo-localization',
    // The console's logo upload (#35) uses the system photo picker. Neutral copy: the app is nobody's.
    // No camera: false drops its usage string (and, on Android, blocks CAMERA). The microphone is
    // dictation's (P3): `false` here would delete its plist string and block RECORD_AUDIO
    // (`tools:node="remove"`) under expo-speech-recognition's feet, so this plugin writes the same
    // text, whichever of the two runs last.
    [
      'expo-image-picker',
      {
        photosPermission: 'Allow $(PRODUCT_NAME) to choose a picture from your photo library.',
        cameraPermission: false,
        microphonePermission: MICROPHONE_COPY,
      },
    ],
    // Dictating a lesson's write-up (P3, docs/mobile/build-log.md "P3. Dictation"). On this phone by
    // default; the speech string is required because the Speech framework is linked, and is asked
    // for only with the person's consent to the phone's online service. No $(PRODUCT_NAME): the
    // system alert already names the app, and the build setting expands to "Aimtruedev".
    [
      'expo-speech-recognition',
      { microphonePermission: MICROPHONE_COPY, speechRecognitionPermission: SPEECH_COPY },
    ],
    // "Add to calendar" (#43) presents the system event editor, which on iOS 17+ needs no permission
    // and never shows these. They are kept because App Store Connect flags a binary that links
    // EventKit (calendars and reminders) without them; write-only, so no full-access string. Neutral copy: the app is nobody's.
    [
      'expo-calendar',
      {
        writeOnlyAccess: true,
        calendarPermission: 'Allow $(PRODUCT_NAME) to add lessons to your calendar.',
        writeOnlyCalendarPermission: 'Allow $(PRODUCT_NAME) to add lessons to your calendar.',
        remindersPermission: 'Allow $(PRODUCT_NAME) to add lessons to your reminders.',
      },
    ],
    // The live lesson on the Lock Screen and in the Dynamic Island (#45): a Live Activity from
    // src/features/teaching/live-lesson-activity.tsx, in the ExpoWidgetsTarget extension, sharing an
    // App Group with the app. No push updates (the system ticks the timer; the app ends it). A
    // simulator build needs no Apple team; a device build needs one for the App Group (and the
    // plugin always writes aps-environment) -- see docs/mobile/testflight.md.
    // Left out of the personal build: a free Apple ID cannot sign the App Group or the push
    // entitlement. The module stays linked, so starting an activity there simply fails, quietly
    // (live-surface.ts swallows driver errors); the in-app banner is unaffected.
    ...(variant === 'personal'
      ? []
      : [
          [
            'expo-widgets',
            {
              bundleIdentifier: `${BASE_ID + SUFFIX[variant]}.ExpoWidgetsTarget`,
              groupIdentifier: `group.${BASE_ID + SUFFIX[variant]}`,
              enablePushNotifications: false,
            },
          ] as [string, Record<string, unknown>],
        ]),
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
    variant: RUNTIME_VARIANT,
    buildVariant: variant,
    productionApiUrl: PRODUCTION_API_URL,
    // Left out when absent: a null here reaches the app's manifest as {}.
    ...(googleIosClientId ? { googleIosClientId } : {}),
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
  },
});
