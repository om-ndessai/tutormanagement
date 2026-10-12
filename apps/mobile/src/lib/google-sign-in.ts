import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { DEV_TOOLS } from './variant';

/**
 * Native Google Sign-In (`@react-native-google-signin/google-signin`), wrapped so the rest of
 * the app sees three answers: an ID token, a cancellation, or an error in plain words.
 *
 * The token is opaque here. It is configured with the portal's WEB client ID, so Google issues
 * it for the web client, and only the Worker's `verifyGoogleIdToken` turns it into an identity
 * (POST /api/auth/google). Nothing here is logged or stored: the session that results is the
 * server's cookie, kept by the platform's cookie store.
 */
type GoogleModule = typeof import('@react-native-google-signin/google-signin');

// Required defensively: a development client built before the library was added has no native
// module, and the import would throw at load. Then Google is simply unavailable.
let google: GoogleModule | null = null;
try {
  google = require('@react-native-google-signin/google-signin') as GoogleModule;
} catch {
  google = null;
}

const rawExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
const extra = {
  googleIosClientId: text(rawExtra.googleIosClientId),
  googleWebClientId: text(rawExtra.googleWebClientId),
};

/** The build's fallback web client ID, used when the server does not name one. */
export const FALLBACK_WEB_CLIENT_ID = extra.googleWebClientId;

/**
 * Whether this build can offer Google sign-in at all. iOS needs the variant's iOS client ID
 * (its reversed form is the URL scheme Google returns to, set by the config plugin); Android
 * needs none in the app: Google matches its client by package name and signing key.
 */
export function googleSignInAvailable(): boolean {
  if (!google) return false;
  if (Platform.OS === 'ios') return Boolean(extra.googleIosClientId);
  return Platform.OS === 'android';
}

/** A Google failure the sign-in screen shows (the server's refusals arrive as ApiRequestError). */
export class GoogleSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleSignInError';
  }
}

const PLAY_SERVICES_MESSAGE =
  'Google Play services is missing or out of date on this device. Update it, then try again.';
const FAILED_MESSAGE = 'Google sign-in failed. Please try again.';

let configuredFor: string | null = null;

/** Configures the library for this web client, once per client ID. */
export function configureGoogle(webClientId: string): void {
  if (!google || configuredFor === webClientId) return;
  google.GoogleSignin.configure({
    webClientId,
    ...(Platform.OS === 'ios' && extra.googleIosClientId ? { iosClientId: extra.googleIosClientId } : {}),
    // Identity only: openid, email and profile, the scopes the consent screen already lists.
    offlineAccess: false,
  });
  configuredFor = webClientId;
}

export type GoogleIdTokenResult = { kind: 'token'; idToken: string } | { kind: 'cancelled' };

/** Asks the person to choose a Google account. A cancellation is an answer, not an error. */
export async function googleIdToken(): Promise<GoogleIdTokenResult> {
  if (!google) throw new GoogleSignInError(FAILED_MESSAGE);
  const { GoogleSignin, isErrorWithCode, statusCodes } = google;
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const response = await GoogleSignin.signIn();
    if (response.type !== 'success') return { kind: 'cancelled' };
    const idToken = response.data.idToken;
    if (!idToken) throw new GoogleSignInError(FAILED_MESSAGE);
    return { kind: 'token', idToken };
  } catch (caught) {
    if (caught instanceof GoogleSignInError) throw caught;
    if (isErrorWithCode(caught)) {
      // Cancelled, or a sign-in already on screen: nothing to say.
      if (caught.code === statusCodes.SIGN_IN_CANCELLED || caught.code === statusCodes.IN_PROGRESS) {
        return { kind: 'cancelled' };
      }
      if (caught.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new GoogleSignInError(PLAY_SERVICES_MESSAGE);
      }
      // Development and e2e builds name Google's code, so a configuration fault can be told
      // from a passing failure. Android's DEVELOPER_ERROR (10) means no OAuth client matches the
      // app's package and signing SHA-1 in the web client's Cloud project.
      if (DEV_TOOLS) {
        const hint =
          String(caught.code) === '10' ? ' — no Android OAuth client matches this package and SHA-1' : '';
        throw new GoogleSignInError(`${FAILED_MESSAGE} (Google code ${String(caught.code)}${hint})`);
      }
    }
    throw new GoogleSignInError(FAILED_MESSAGE);
  }
}

/**
 * A fresh ID token for the account last chosen here, without asking -- or null when there is
 * none (never signed in here, signed out, or Google refuses). Used once when a session ends.
 */
export async function silentIdToken(): Promise<string | null> {
  if (!google || !configuredFor) return null;
  try {
    if (!google.GoogleSignin.hasPreviousSignIn()) return null;
    const response = await google.GoogleSignin.signInSilently();
    return response.type === 'success' ? (response.data.idToken ?? null) : null;
  } catch {
    return null;
  }
}

/** Forgets the Google account on this device, so the next sign-in asks again. */
export async function googleSignOut(): Promise<void> {
  if (!google) return;
  try {
    await google.GoogleSignin.signOut();
  } catch {
    // Signing out of the portal is what matters.
  }
}

/**
 * Google's own sign-in button (its "G" mark and "Sign in with Google", per its branding rules),
 * or null when the native module is missing. Reached through here so nothing imports the
 * library directly.
 */
export const GoogleButton = google?.GoogleSigninButton ?? null;
