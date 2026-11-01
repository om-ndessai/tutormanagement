// Ported from apps/web/src/providers/auth-provider.tsx @ 1132322 (Phase 52's sign-up @ 9485a8e;
// Phase 60's landing @ f96b984 plus the working tree)
import { useQueryClient } from '@tanstack/react-query';
import {
  DEFAULT_ORG_TIME_ZONE,
  type ApiOk,
  type AuthConfig,
  type Invitation,
  type Membership,
  type MyJoinRequest,
  type OnboardingState,
  type PlatformAccount,
  type SessionResponse,
  type SignupStart,
  type User,
} from '@tmi/shared';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { landingFor } from '@/features/auth/landing';
import { resetInvitationBanner } from '@/features/organizations/spaces-model';
import { offersGoogle, signInProviders, type UsableProvider } from '@/features/auth/provider-model';
import { signupRequest, type PendingSignup, type SignupForm } from '@/features/auth/sign-up-model';
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
import { appleAvailable, PROVIDER_BUILD, ProviderSignInError, providerToken } from '@/lib/provider-sign-in';
import { clearActiveOrg, getActiveOrg, lastOrg, setActiveOrg } from '@/lib/organization';
import { APP_VARIANT, devUser, loadServerPrefs, setDevUser, setServerAuthEnabled } from '@/lib/server';

/** Phase 50: how often a feature_unavailable refusal may re-read the session. */
export const FEATURE_REFRESH_MS = 10_000;

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
  /** Phase 52: a self-registered person's age band; null for anyone a space added. */
  account: PlatformAccount | null;
  /** Phase 52: their own open (or just declined) requests to join a space. */
  joinRequests: MyJoinRequest[];
  /**
   * Phase 52: a newcomer between their Google sign-in (or the developer's "Sign up as") and the
   * age question. Held in memory only -- never stored.
   */
  pendingSignup: PendingSignup | null;
  /** Phase 52, sign-in off: signs up a typed address the server does not know. */
  startDevSignup: (email: string, name?: string) => void;
  /** Phase 52: answers the age question and the terms, and signs the newcomer in. Throws the refusal. */
  completeSignup: (form: SignupForm) => Promise<void>;
  /** Phase 52: abandons the sign-up (back to sign-in, Google forgotten). */
  cancelSignup: () => Promise<void>;
  /** True the first time this person has ever opened this organization. */
  firstVisit: boolean;
  /** Enters an organization: caches cleared, the session re-read inside it. */
  chooseOrganization: (slug: string) => Promise<void>;
  /** Leaves the organization for the picker (or the console). */
  leaveOrganization: () => void;
  /**
   * Phase 60: forgets the space the app is in and lands again by the rule (the person's last
   * space, their only one, or the selector) -- after leaving the space they were in.
   */
  reland: () => Promise<void>;
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
  /**
   * Phase 55: the providers besides Google that the server offers and this build can use, in the
   * server's order (Microsoft, Apple, Facebook).
   */
  providers: UsableProvider[];
  /** Phase 55: signs in with one of `providers`, answered as Google is (a session or the sign-up start). */
  signInWithProvider: (provider: UsableProvider) => Promise<void>;
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
    caught instanceof GoogleSignInError || caught instanceof ProviderSignInError ? caught.message : 'Sign-in failed. Please try again.',
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
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [joinRequests, setJoinRequests] = useState<MyJoinRequest[]>([]);
  const [pendingSignup, setPendingSignup] = useState<PendingSignup | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [impersonated, setImpersonated] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Phase 55: whether this device offers Sign in with Apple (asked once; false unless the build's flag is on).
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => {
    let live = true;
    void appleAvailable().then((ready) => {
      if (live) setAppleReady(ready);
    });
    return () => {
      live = false;
    };
  }, []);

  // The space this run chose (switched to, entered or landed in); null while ARRIVING (a fresh
  // launch or sign-in), when the landing rule decides -- never the device's remembered last space.
  const ownRef = useRef<string | null>(null);
  // A link naming a space (the developer link's `org`): kept until the app is in it, or it cannot be entered.
  const linkedRef = useRef<string | null>(null);

  const applySession = useCallback(async (session: SessionResponse): Promise<boolean> => {
    setImpersonated(session.impersonated);
    setOnboarding(session.onboarding);
    setMemberships(session.memberships);
    setInvitations(session.invitations);
    setPlatformAdmin(session.platform_admin);
    setAccount(session.account ?? null);
    setJoinRequests(session.join_requests ?? []);

    const landing = landingFor(session, { own: ownRef.current, linked: linkedRef.current });
    if (landing.kind !== 'enter' || landing.slug !== linkedRef.current) linkedRef.current = null;
    if (landing.kind === 'enter') {
      await setActiveOrg(landing.slug);
      ownRef.current = landing.slug;
      return false;
    }
    if (landing.kind === 'in') {
      ownRef.current = landing.slug;
      await setActiveOrg(landing.slug);
      setOrganization(session.organization);
      setUser(session.user);
      return true;
    }
    ownRef.current = null;
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
    ownRef.current = null;
    linkedRef.current = null;
    resetInvitationBanner();
    setUser(null);
    setOrganization(null);
    setMemberships([]);
    setInvitations([]);
    setPlatformAdmin(false);
    setAccount(null);
    setJoinRequests([]);
    setImpersonated(false);
    setStatus('unauthenticated');
  }, [queryClient]);

  const boot = useCallback(async () => {
    await loadServerPrefs();
    // The last space this device used names the first request's space (the web app's
    // tmi_last_org cookie), which saves a round trip when it is also the person's last choice.
    // It never decides: an arriving run lands by the rule, on the server's choice (Phase 60).
    clearActiveOrg();
    ownRef.current = null;
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
  // the person's first visit ever, which offers them the tour. Phase 60: it also makes this space
  // the person's last choice, where they land next on any device.
  const enteredSlug = organization?.slug ?? null;
  // The space the app is in, for chooseOrganization (which must not close over a stale one).
  const enteredRef = useRef<string | null>(null);
  useEffect(() => {
    enteredRef.current = enteredSlug;
  }, [enteredSlug]);
  useEffect(() => {
    if (!enteredSlug) return;
    apiClient
      .post<ApiOk<{ first_visit: boolean }>>('/auth/enter')
      .then((response) => setFirstVisit(response.data.first_visit))
      .catch(() => undefined);
  }, [enteredSlug]);

  const leaveOrganization = useCallback(() => {
    clearActiveOrg();
    ownRef.current = null;
    queryClient.clear();
    setOrganization(null);
    setFirstVisit(false);
  }, [queryClient]);

  const reland = useCallback(async () => {
    leaveOrganization();
    await loadSession();
  }, [leaveOrganization, loadSession]);

  // The organization may not be entered any more (archived, or the person was removed): back to
  // the landing rule -- their other space, or the selector.
  useEffect(
    () =>
      on('organization-required', () => {
        if (!getActiveOrg()) return;
        void reland().catch(() => undefined);
      }),
    [reland],
  );

  // Phase 50: a feature set switched off while the app is open answers 403 feature_unavailable. The
  // session is re-read (at most once in 10 s), so the menu, the bar and every gate follow.
  const lastFeatureRefresh = useRef(0);
  useEffect(
    () =>
      on('feature-unavailable', () => {
        const now = Date.now();
        if (now - lastFeatureRefresh.current < FEATURE_REFRESH_MS) return;
        lastFeatureRefresh.current = now;
        void loadSession().catch(() => undefined);
      }),
    [loadSession],
  );

  // Any 401 from anywhere drops the app back to signed out (after the one silent renewal).
  useEffect(() => on('unauthenticated', () => resetSignedOut()), [resetSignedOut]);

  const googleAvailable =
    config?.auth_enabled === true &&
    offersGoogle(config) &&
    Boolean(config.google_client_id ?? FALLBACK_WEB_CLIENT_ID) &&
    googleSignInAvailable();

  const providers = useMemo(
    () => (config?.auth_enabled ? signInProviders(config.providers, PROVIDER_BUILD, appleReady) : []),
    [config, appleReady],
  );

  const chooseOrganization = useCallback(
    async (slug: string) => {
      // Everything starts clean in the new organization: no cached row from the old one survives.
      queryClient.clear();
      setFirstVisit(false);
      const already = enteredRef.current === slug;
      await setActiveOrg(slug);
      ownRef.current = slug;
      await loadSession();
      // A choice opens the space, even the one the app is in: it becomes the last choice, as on the
      // web (S4, S7). The entering effect above only runs when the space changes, so say it here.
      if (already) {
        await apiClient
          .post<ApiOk<{ first_visit: boolean }>>('/auth/enter')
          .then((response) => setFirstVisit(response.data.first_visit))
          .catch(() => undefined);
      }
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
      // Phase 52: this client can sign a newcomer up, so an unknown account is not refused: it
      // answers who Google says they are, and the age question comes next.
      const answer = await apiClient.post<ApiOk<SessionResponse | SignupStart>>('/auth/google', {
        credential: result.idToken,
        signup: true,
      });
      if ('signup' in answer.data) {
        setPendingSignup({ ...answer.data.signup, dev: false });
        setStatus('unauthenticated');
        return;
      }
      // Arriving: the landing rule decides (their last space, on any device), as on the web.
      queryClient.clear();
      ownRef.current = null;
      await loadSession();
      setStatus('authenticated');
    } catch (caught) {
      // The server's refusal (no account, unverified, suspended) in its own words, or Google's.
      await googleSignOut();
      resetSignedOut();
      setError(toError(caught));
    }
  }, [loadSession, queryClient, resetSignedOut]);

  const signInWithProvider = useCallback(
    async (provider: UsableProvider) => {
      setError(null);
      try {
        const result = await providerToken(provider);
        // The person closed the browser or the sheet: nothing happened, so nothing is said.
        if (result.kind === 'cancelled') return;
        const answer = await apiClient.post<ApiOk<SessionResponse | SignupStart>>(`/auth/${provider.id}`, {
          ...result.body,
          signup: true,
        });
        if ('signup' in answer.data) {
          setPendingSignup({ ...answer.data.signup, dev: false });
          setStatus('unauthenticated');
          return;
        }
        queryClient.clear();
        ownRef.current = null;
        await loadSession();
        setStatus('authenticated');
      } catch (caught) {
        // The server's refusal (no_account says to sign in the way they did before), or the provider's.
        resetSignedOut();
        setError(toError(caught));
      }
    },
    [loadSession, queryClient, resetSignedOut],
  );

  const signInAsDevUser = useCallback(
    async (email: string, org?: string | null) => {
      setError(null);
      if (APP_VARIANT === 'production') return;
      await setDevUser(email);
      queryClient.clear();
      // Arriving; a linked space is entered ahead of the person's last one (as a web link is).
      ownRef.current = null;
      linkedRef.current = org || null;
      if (org) await setActiveOrg(org);
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

  const startDevSignup = useCallback((email: string, name?: string) => {
    if (APP_VARIANT === 'production') return;
    setError(null);
    const address = email.trim().toLowerCase();
    setPendingSignup({ token: null, email: address, name: name?.trim() || address, dev: true });
  }, []);

  const completeSignup = useCallback(
    async (form: SignupForm) => {
      if (!pendingSignup) return;
      await apiClient.post<ApiOk<SessionResponse>>('/auth/signup', signupRequest(form, pendingSignup));
      // Sign-in off: act as the new person -- only now, after the 201, so a refused under-13
      // leaves no persona behind on the device.
      if (pendingSignup.dev) await setDevUser(pendingSignup.email);
      setPendingSignup(null);
      queryClient.clear();
      ownRef.current = null;
      await loadSession();
      setStatus('authenticated');
    },
    [pendingSignup, loadSession, queryClient],
  );

  const cancelSignup = useCallback(async () => {
    const wasGoogle = pendingSignup !== null && !pendingSignup.dev;
    setPendingSignup(null);
    if (wasGoogle) await googleSignOut();
  }, [pendingSignup]);

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
      account,
      joinRequests,
      pendingSignup,
      startDevSignup,
      completeSignup,
      cancelSignup,
      firstVisit,
      chooseOrganization,
      leaveOrganization,
      reland,
      refreshSession,
      config,
      impersonated,
      onboarding,
      setOnboarding,
      error,
      statusMessage,
      googleAvailable,
      signInWithGoogle,
      providers,
      signInWithProvider,
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
      account,
      joinRequests,
      pendingSignup,
      startDevSignup,
      completeSignup,
      cancelSignup,
      firstVisit,
      chooseOrganization,
      leaveOrganization,
      reland,
      refreshSession,
      config,
      impersonated,
      onboarding,
      error,
      statusMessage,
      googleAvailable,
      signInWithGoogle,
      providers,
      signInWithProvider,
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

/**
 * The auth context where there may be none (a query hook also used by tests that render without
 * the provider): null outside it.
 */
export function useOptionalAuth(): AuthContextValue | null {
  return use(AuthContext);
}
