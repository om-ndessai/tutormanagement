import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Phase 55 (docs/social-login-plan.md): signing in with Microsoft, Facebook and Apple, wrapped so the
 * rest of the app sees three answers: the body to post to `POST /auth/<provider>` (or
 * `/auth/identities/<provider>`), a cancellation, or an error in plain words.
 *
 * Tokens are opaque here: only the Worker's verifiers (`lib/microsoft.ts`, `lib/facebook.ts`,
 * `lib/apple.ts`) turn one into an identity. Nothing here is logged or stored; the session that results
 * is the server's cookie, kept by the platform's cookie store.
 *
 * - Microsoft: `expo-auth-session`, the authorization code with PKCE in the system browser, redirected
 *   to `<scheme>://auth/microsoft`, exchanged at Microsoft's token endpoint as a public client (no
 *   secret) for the ID token.
 * - Facebook: `expo-auth-session` with Facebook's web OAuth dialog (`response_type=token`), redirected to
 *   `fb<app id>://authorize`; the access token is posted. No native Facebook SDK (no Meta app yet).
 * - Apple: `expo-apple-authentication`, behind `EXPO_PUBLIC_APPLE_SIGN_IN` (off: no paid Apple team).
 */
type AuthSessionModule = typeof import('expo-auth-session');
type AppleModule = typeof import('expo-apple-authentication');

// Required defensively, as the Google module is: a development client built before these were added
// has no native module, and the import would throw at load. Then the provider is simply unavailable.
let authSession: AuthSessionModule | null = null;
try {
  authSession = require('expo-auth-session') as AuthSessionModule;
} catch {
  authSession = null;
}
let apple: AppleModule | null = null;
try {
  apple = Platform.OS === 'ios' ? (require('expo-apple-authentication') as AppleModule) : null;
} catch {
  apple = null;
}

const rawExtra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** What this build can do, as `signInProviders` reads it. */
export interface ProviderBuild {
  platform: 'ios' | 'android' | string;
  /** The browser flows' module is linked (Microsoft, Facebook). */
  browser: boolean;
  /** Apple's button: iOS, the module linked, and the build's flag on. */
  apple: boolean;
  /** The Facebook app id whose `fb<id>` scheme this build registered, or null. */
  facebookAppId: string | null;
}

export const PROVIDER_BUILD: ProviderBuild = {
  platform: Platform.OS,
  browser: authSession !== null,
  apple: apple !== null && rawExtra.appleSignIn === true,
  facebookAppId: text(rawExtra.facebookAppId),
};

/** The body a provider's sign-in posts: `providerSignInSchema` in shared. */
export interface ProviderToken {
  id_token?: string;
  access_token?: string;
  name?: string;
  authorization_code?: string;
}

export type ProviderTokenResult = { kind: 'token'; body: ProviderToken } | { kind: 'cancelled' };

/** A provider's failure the sign-in screen shows (the server's refusals arrive as ApiRequestError). */
export class ProviderSignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderSignInError';
  }
}

const MICROSOFT = {
  authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};
const FACEBOOK = { authorizationEndpoint: 'https://www.facebook.com/v21.0/dialog/oauth' };

/** The app's own link scheme (`aimtrue`, or `aimtrue-test` for AimTrue-Test). */
function appScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  return (Array.isArray(scheme) ? scheme[0] : scheme) ?? 'aimtrue';
}

/** Microsoft's redirect for this build, as `docs/sign-in-providers-setup.md` registers it. */
export function microsoftRedirectUri(): string {
  return `${appScheme()}://auth/microsoft`;
}

/** Facebook's redirect: the scheme Meta's own apps use, `fb<app id>://authorize`. */
export function facebookRedirectUri(appId: string): string {
  return `fb${appId}://authorize`;
}

const failed = (label: string) => `${label} sign-in failed. Please try again.`;

/** Microsoft: a personal, work or school account, through the system browser. */
export async function microsoftToken(clientId: string): Promise<ProviderTokenResult> {
  if (!authSession) throw new ProviderSignInError(failed('Microsoft'));
  const { AuthRequest, ResponseType, exchangeCodeAsync } = authSession;
  const redirectUri = microsoftRedirectUri();
  const request = new AuthRequest({
    clientId,
    redirectUri,
    responseType: ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    extraParams: { prompt: 'select_account' },
  });
  const result = await request.promptAsync(MICROSOFT);
  if (result.type !== 'success') {
    if (result.type === 'error') throw new ProviderSignInError(failed('Microsoft'));
    return { kind: 'cancelled' };
  }
  try {
    const tokens = await exchangeCodeAsync(
      {
        clientId,
        code: result.params.code ?? '',
        redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : {},
      },
      MICROSOFT,
    );
    if (!tokens.idToken) throw new ProviderSignInError(failed('Microsoft'));
    return { kind: 'token', body: { id_token: tokens.idToken } };
  } catch {
    throw new ProviderSignInError(failed('Microsoft'));
  }
}

/** Facebook: its web dialog in the system browser, returning an access token. */
export async function facebookToken(appId: string): Promise<ProviderTokenResult> {
  if (!authSession) throw new ProviderSignInError(failed('Facebook'));
  const { AuthRequest, ResponseType } = authSession;
  const request = new AuthRequest({
    clientId: appId,
    redirectUri: facebookRedirectUri(appId),
    responseType: ResponseType.Token,
    scopes: ['public_profile', 'email'],
    usePKCE: false,
  });
  const result = await request.promptAsync(FACEBOOK);
  if (result.type !== 'success') {
    if (result.type === 'error') throw new ProviderSignInError(failed('Facebook'));
    return { kind: 'cancelled' };
  }
  const accessToken = result.params.access_token ?? result.authentication?.accessToken;
  if (!accessToken) throw new ProviderSignInError(failed('Facebook'));
  return { kind: 'token', body: { access_token: accessToken } };
}

/** Whether this device offers Sign in with Apple (iOS 13+, the build's flag on). */
export async function appleAvailable(): Promise<boolean> {
  if (!apple || !PROVIDER_BUILD.apple) return false;
  try {
    return await apple.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Apple: the system sheet. The name comes only the first time, so it is passed along then. */
export async function appleToken(): Promise<ProviderTokenResult> {
  if (!apple) throw new ProviderSignInError(failed('Apple'));
  try {
    const credential = await apple.signInAsync({
      requestedScopes: [
        apple.AppleAuthenticationScope.FULL_NAME,
        apple.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new ProviderSignInError(failed('Apple'));
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
    return {
      kind: 'token',
      body: {
        id_token: credential.identityToken,
        ...(credential.authorizationCode ? { authorization_code: credential.authorizationCode } : {}),
        ...(name ? { name } : {}),
      },
    };
  } catch (caught) {
    if (caught instanceof ProviderSignInError) throw caught;
    if ((caught as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED') return { kind: 'cancelled' };
    throw new ProviderSignInError(failed('Apple'));
  }
}

/** The token for one of the providers `signInProviders` offers. */
export function providerToken(provider: { id: 'microsoft' | 'facebook' | 'apple'; clientId: string | null }): Promise<ProviderTokenResult> {
  switch (provider.id) {
    case 'microsoft':
      return microsoftToken(provider.clientId ?? '');
    case 'facebook':
      return facebookToken(provider.clientId ?? '');
    case 'apple':
      return appleToken();
  }
}
