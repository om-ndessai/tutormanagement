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
import { ApiRequestError, apiClient } from '@/lib/api-client';
import { on } from '@/lib/events';
import { clearActiveOrg, getActiveOrg, lastOrg, setActiveOrg } from '@/lib/organization';
import { APP_VARIANT, devUser, loadServerPrefs, setDevUser } from '@/lib/server';

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
  error: ApiRequestError | null;
  statusMessage: string | null;
  /** Developer sign-in: act as a seeded person on a server with sign-in off. */
  /** `org`: a linked organization, entered ahead of the person's default (as a web link does). */
  signInAsDevUser: (email: string, org?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-runs boot from scratch, e.g. after choosing another server. */
  reboot: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The whole authentication lifecycle: loads the server's public config, restores who the app
 * is signed in as, and decides which organization it is in.
 *
 * Until Phase 4 the only way in is the developer sign-in, against a server whose sign-in is
 * switched off: the API then acts as the `X-Dev-User` the client sends. "Signed out" is
 * decided here, by having no such person: such a server would otherwise act as its first admin.
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

    if (loaded.auth_enabled || !devUser()) {
      // Google sign-in arrives in Phase 4; until then a server with sign-in on cannot be entered.
      resetSignedOut();
      return;
    }

    try {
      await loadSession();
      setStatus('authenticated');
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status !== 401 && reason.status !== 404) {
        setStatusMessage(reason.message);
        setStatus('error');
        return;
      }
      await setDevUser(null);
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

  // Any 401 from anywhere drops the app back to signed out.
  useEffect(() => on('unauthenticated', () => resetSignedOut()), [resetSignedOut]);

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
        setError(
          caught instanceof ApiRequestError
            ? caught
            : new ApiRequestError(0, 'internal_error', 'Sign-in failed. Please try again.'),
        );
      }
    },
    [loadSession, queryClient, resetSignedOut],
  );

  const signOut = useCallback(async () => {
    try {
      if (config?.auth_enabled) await apiClient.post('/auth/logout');
    } catch {
      // Signing out locally is what matters.
    } finally {
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
