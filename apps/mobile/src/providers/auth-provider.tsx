// Ported from apps/web/src/providers/auth-provider.tsx @ 1132322
import { useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_ORG_TIME_ZONE,
  type ApiOk,
  type AuthConfig,
  type Invitation,
  type Membership,
  type OnboardingState,
  type SessionResponse,
  type User,
} from '@tmi/shared';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { decideLanding } from '@/features/auth/landing';
import { ApiRequestError, apiClient, setReauthenticator } from '@/lib/api-client';
import { on } from '@/lib/events';
import {
  configureGoogle,
  FALLBACK_WEB_CLIENT_ID,
  googleIdToken,
  googleSignInAvailable,
  GoogleSignInError,
  googleSignOut,
  silentIdToken,
} from '@/lib/google-sign-in';
import { clearActiveOrg, getActiveOrg, lastOrg, setActiveOrg } from '@/lib/organization';
import { APP_VARIANT, devUser, loadServerPrefs, setDevUser, setServerAuthEnabled } from '@/lib/server';

/** The organization the app is in, with its payer details for its admins. */
export type ActiveOrganization = NonNullable<SessionResponse['organization']>;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  /** The person AS A MEMBER of the active organization: roles there only. */
  user: User | null;
  /** The organization the app is in; null while choosing, or on the console. */
  organization: ActiveOrganization | null;
  memberships: Membership[];
  invitations: Invitation[];
  platformAdmin: boolean;
  /** True the first time this person has ever opened this organization. */
  firstVisit: boolean;
  /** Enters an organization: caches cleared, the session re-read inside it. */
  chooseOrganization: (slug: string) => Promise<void>;
  /** Leaves the organization for the picker (or the console). */
  leaveOrganization: () => void;
  refreshSession: () => Promise<void>;
  config: AuthConfig | null;
  /** True when the API is running with sign-in switched off. */
  impersonated: boolean;
  onboarding: OnboardingState | null;
  setOnboarding: (state: OnboardingState) => void;
  /** Why the last sign-in attempt failed: the server's refusal (its code and words) or Google's. */
  error: ApiRequestError | null;
  statusMessage: string | null;
  /** Whether this build and this server offer Google sign-in. */
  googleAvailable: boolean;
  /**
   * Google sign-in (the web's signInWithGoogle): choose an account, exchange its ID token at
   * POST /auth/google for the session cookie, then read the session. Cancelling says nothing.
   */
  signInWithGoogle: () => Promise<void>;
  /** Developer sign-in: act as a seeded person on a server with sign-in off. */
  /** `org`: a linked organization, entered ahead of the person's default (as a web link does). */
  signInAsDevUser: (email: string, org?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-runs boot from scratch, e.g. after choosing another server. */
  reboot: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** A failed sign-in as the screen shows it: the server's refusal as sent, or Google's words. */
function toError(caught: unknown): ApiRequestError {
  if (caught instanceof ApiRequestError) return caught;
  return new ApiRequestError(
    0,
    'internal_error',
    caught instanceof GoogleSignInError ? caught.message : 'Sign-in failed. Please try again.',
  );
}

/**
 * Renews a session that ended (the cookie's 12 hours are up) once, without asking: a silent
 * Google sign-in for the account last chosen here, exchanged for a new cookie. An explicit
 * sign-out forgets that account, so this never re-enters on its own after one.
 */
async function renewWithGoogle(): Promise<boolean> {
  const credential = await silentIdToken();
  if (!credential) return false;
  await apiClient.post('/auth/google', { credential });
  return true;
}

/**
 * The whole authentication lifecycle: loads the server's public config, restores who the app
 * is signed in as, and decides which organization it is in.
 *
 * Two ways in, decided by the server's `auth_enabled`:
 * - **Sign-in on:** Google. The session is the server's HttpOnly `tmi_session` cookie, which the
 *   platform keeps; on boot `GET /auth/session` with it decides signed in or out. When it ends
 *   mid-use, one silent Google sign-in renews it (the api client retries the request once).
 * - **Sign-in off (development and e2e builds only):** the developer sign-in. The API acts as
 *   the `X-Dev-User` the client sends. "Signed out" is decided here, by having no such person:
 *   such a server would otherwise act as its first admin.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<ActiveOrganization | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [platformAdmin, setPlatformAdmin] = useState(false);
  const [firstVisit, setFirstVisit] = useState(false);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [impersonated, setImpersonated] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Arriving: a fresh launch or a fresh sign-in, when a default organization decides.
  const arrivingRef = useRef(true);

  const applySession = useCallback(async (session: SessionResponse): Promise<boolean> => {
    setImpersonated(session.impersonated);
    setOnboarding(session.onboarding);
    setMemberships(session.memberships);
    setInvitations(session.invitations);
    setPlatformAdmin(session.platform_admin);

    const landing = decideLanding(session, arrivingRef.current);
    if (landing.kind === 'enter') {
      await setActiveOrg(landing.slug);
      // A default is honoured once, on arrival; a single membership is simply entered.
      arrivingRef.current = false;
      return false;
    }
    arrivingRef.current = false;
    if (landing.kind === 'in') {
      await setActiveOrg(landing.slug);
      setOrganization(session.organization);
      setUser(session.user);
      return true;
    }
    clearActiveOrg();
    setOrganization(null);
    setUser(session.user);
    return true;
  }, []);

  const loadSession = useCallback(async () => {
    let session = (await apiClient.get<ApiOk<SessionResponse>>('/auth/session')).data;
    if (!(await applySession(session))) {
      session = (await apiClient.get<ApiOk<SessionResponse>>('/auth/session')).data;
      await applySession(session);
    }
    return session;
  }, [applySession]);

  const resetSignedOut = useCallback(() => {
    queryClient.clear();
    clearActiveOrg();
    arrivingRef.current = true;
    setUser(null);
    setOrganization(null);
    setMemberships([]);
    setInvitations([]);
    setPlatformAdmin(false);
    setImpersonated(false);
    setStatus('unauthenticated');
  }, [queryClient]);

  const boot = useCallback(async () => {
    await loadServerPrefs();
    // The last organization this device used is where an arriving run starts looking (the
    // web app's tmi_last_org cookie); a default membership still outranks it.
    clearActiveOrg();
    const last = await lastOrg();
    if (last) await setActiveOrg(last);

    let loaded: AuthConfig;
    try {
      loaded = (await apiClient.get<ApiOk<AuthConfig>>('/auth/config')).data;
      setConfig(loaded);
    } catch (reason) {
      setStatusMessage(reason instanceof ApiRequestError ? reason.message : 'The server did not respond.');
      setStatus('error');
      return;
    }

    setServerAuthEnabled(loaded.auth_enabled);
    const webClientId = loaded.google_client_id ?? FALLBACK_WEB_CLIENT_ID;
    const google = loaded.auth_enabled && Boolean(webClientId) && googleSignInAvailable();
    // Google: configured for the server's own web client, which is the audience it verifies.
    if (google && webClientId) configureGoogle(webClientId);
    // Registered before the session is read, so a cookie that ended overnight renews here too.
    setReauthenticator(google ? renewWithGoogle : null);
    if (!loaded.auth_enabled && !devUser()) {
      // Sign-in off and nobody chosen: signed out (the server would act as its first admin).
      resetSignedOut();
      return;
    }

    // Sign-in on: the stored cookie decides (a 401 is the normal signed-out case, after the one
    // silent renewal the api client tries). Sign-in off: the developer persona does.
    try {
      await loadSession();
      setStatus('authenticated');
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status !== 401 && reason.status !== 404) {
        setStatusMessage(reason.message);
        setStatus('error');
        return;
      }
      if (!loaded.auth_enabled) await setDevUser(null);
      resetSignedOut();
    }
  }, [loadSession, resetSignedOut]);

  useEffect(() => {
    // boot() is async: every state update in it happens after an await, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void boot();
  }, [boot]);

  const reboot = useCallback(async () => {
    setStatus('loading');
    setStatusMessage(null);
    await boot();
  }, [boot]);

  // Once inside an organization, say so -- once per entry. The API answers whether this is
  // the person's first visit ever, which offers them the tour.
  const enteredSlug = organization?.slug ?? null;
  useEffect(() => {
    if (!enteredSlug) return;
    apiClient
      .post<ApiOk<{ first_visit: boolean }>>('/auth/enter')
      .then((response) => setFirstVisit(response.data.first_visit))
      .catch(() => undefined);
  }, [enteredSlug]);

  const leaveOrganization = useCallback(() => {
    clearActiveOrg();
    queryClient.clear();
    setOrganization(null);
    setFirstVisit(false);
  }, [queryClient]);

  // The organization may not be entered any more (archived, or the person was removed).
  useEffect(
    () =>
      on('organization-required', () => {
        if (!getActiveOrg()) return;
        leaveOrganization();
      }),
    [leaveOrganization],
  );

  // Any 401 from anywhere drops the app back to signed out (after the one silent renewal).
  useEffect(() => on('unauthenticated', () => resetSignedOut()), [resetSignedOut]);

  const googleAvailable =
    config?.auth_enabled === true &&
    Boolean(config.google_client_id ?? FALLBACK_WEB_CLIENT_ID) &&
    googleSignInAvailable();

  const chooseOrganization = useCallback(
    async (slug: string) => {
      // Everything starts clean in the new organization: no cached row from the old one survives.
      queryClient.clear();
      setFirstVisit(false);
      await setActiveOrg(slug);
      arrivingRef.current = false;
      await loadSession();
    },
    [loadSession, queryClient],
  );

  const refreshSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  const signInWithGoogle = useCallback(async () => {
    setError(null);
    try {
      const result = await googleIdToken();
      // The person closed Google's sheet: nothing happened, so nothing is said.
      if (result.kind === 'cancelled') return;
      await apiClient.post<ApiOk<SessionResponse>>('/auth/google', { credential: result.idToken });
      // Arriving: the person's default organization decides where they land, as on the web.
      queryClient.clear();
      arrivingRef.current = true;
      await loadSession();
      setStatus('authenticated');
    } catch (caught) {
      // The server's refusal (no account, unverified, suspended) in its own words, or Google's.
      await googleSignOut();
      resetSignedOut();
      setError(toError(caught));
    }
  }, [loadSession, queryClient, resetSignedOut]);

  const signInAsDevUser = useCallback(
    async (email: string, org?: string | null) => {
      setError(null);
      if (APP_VARIANT === 'production') return;
      await setDevUser(email);
      queryClient.clear();
      if (org) {
        await setActiveOrg(org);
        arrivingRef.current = false;
      } else {
        arrivingRef.current = true;
      }
      try {
        await loadSession();
        setStatus('authenticated');
      } catch (caught) {
        await setDevUser(null);
        resetSignedOut();
        setError(toError(caught));
      }
    },
    [loadSession, queryClient, resetSignedOut],
  );

  const signOut = useCallback(async () => {
    try {
      // Clears the session cookie (the server answers with an expired one).
      if (config?.auth_enabled) await apiClient.post('/auth/logout');
    } catch {
      // Signing out locally is what matters.
    } finally {
      // Forget the Google account too, so the next sign-in asks and nothing renews silently.
      if (config?.auth_enabled) await googleSignOut();
      await setDevUser(null);
      setError(null);
      resetSignedOut();
    }
  }, [config, resetSignedOut]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      organization,
      memberships,
      invitations,
      platformAdmin,
      firstVisit,
      chooseOrganization,
      leaveOrganization,
      refreshSession,
      config,
      impersonated,
      onboarding,
      setOnboarding,
      error,
      statusMessage,
      googleAvailable,
      signInWithGoogle,
      signInAsDevUser,
      signOut,
      reboot,
      clearError,
    }),
    [
      status,
      user,
      organization,
      memberships,
      invitations,
      platformAdmin,
      firstVisit,
      chooseOrganization,
      leaveOrganization,
      refreshSession,
      config,
      impersonated,
      onboarding,
      error,
      statusMessage,
      googleAvailable,
      signInWithGoogle,
      signInAsDevUser,
      signOut,
      reboot,
      clearError,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/** The clock this organization records its lessons against. Every "today" is on it. */
export function useOrgTimeZone(): string {
  const { organization } = useAuth();
  return organization?.time_zone ?? DEFAULT_ORG_TIME_ZONE;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
