import {
  createContext,
  use,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DEFAULT_ORG_TIME_ZONE } from '@tmi/shared';
import type {
  ApiOk,
  AuthConfig,
  Invitation,
  Membership,
  OnboardingState,
  SessionResponse,
  User,
} from '@tmi/shared';

import {
  ApiRequestError,
  ORGANIZATION_REQUIRED_EVENT,
  UNAUTHENTICATED_EVENT,
  apiClient,
} from '@/lib/api-client';
import { clearActiveOrg, getActiveOrg, hasTabOrg, setActiveOrg, takeLinkedOrg } from '@/lib/organization';

/** The organization this tab is in, with its payer details for its admins. */
export type ActiveOrganization = NonNullable<SessionResponse['organization']>;

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  /** The person AS A MEMBER of the active organization: roles there only. */
  user: User | null;
  /** The organization this tab is in; null while choosing, or on the console. */
  organization: ActiveOrganization | null;
  /** Every organization the person may enter. */
  memberships: Membership[];
  /** Organizations waiting for an answer. */
  invitations: Invitation[];
  /** Whether the person may use the platform console. */
  platformAdmin: boolean;
  /** True the first time this person has ever opened this organization. */
  firstVisit: boolean;
  /** Enters an organization in this tab: everything reloads in it. */
  chooseOrganization: (slug: string) => void;
  /** Re-reads the session, e.g. after answering an invitation. */
  refreshSession: () => Promise<void>;
  /** Public auth config from the Worker; null until it loads. */
  config: AuthConfig | null;
  /** True when the API is running with AUTH_ENABLED=false. */
  impersonated: boolean;
  /** Whether this person has been through the welcome wizard (Phase 26). */
  onboarding: OnboardingState | null;
  /** Records a change the onboarding routes answered with. */
  setOnboarding: (state: OnboardingState) => void;
  /** Why the last sign-in attempt failed, if it did. */
  error: ApiRequestError | null;
  /**
   * Why `status` is 'error'. Surfaced verbatim, because the reason is usually a
   * configuration problem the operator can act on -- a generic "can't reach the
   * portal" screen once hid an empty user table for an entire debugging round.
   */
  statusMessage: string | null;
  signInWithGoogle: (credential: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Owns the whole authentication lifecycle: loads public config, restores an
 * existing session on boot, and exchanges a Google credential for one.
 *
 * The session itself is an HttpOnly cookie the browser never sees — this only
 * tracks who the server says we are.
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

  /**
   * Takes in what the server says about the session, and decides which
   * organization this tab is in: the one it named, if the person may still
   * enter it; otherwise, if there is exactly one place to go, that one. With
   * several, nothing is chosen and the picker asks.
   *
   * A tab that is only arriving (no organization of its own yet: just signed
   * in, or newly opened) lands in the person's default organization when they
   * have chosen one and may still enter it -- ahead of the browser's last
   * one and the address's own. Once in, the tab keeps its own choice.
   */
  // Whether this tab is arriving, decided once when it opens (and again on
  // signing out) -- not when a response comes back, by which time another
  // load may already have written the tab's organization and the two would
  // disagree about where to land.
  // A link that names an organization (a notification email's) enters it,
  // ahead of the person's default: they followed a link about that one.
  const arrivingRef = useRef<boolean | null>(null);
  if (arrivingRef.current === null) {
    const linked = takeLinkedOrg();
    if (linked) setActiveOrg(linked);
    arrivingRef.current = !hasTabOrg();
  }

  const applySession = useCallback((session: SessionResponse): boolean => {
    setImpersonated(session.impersonated);
    setOnboarding(session.onboarding);
    setMemberships(session.memberships);
    setInvitations(session.invitations);
    setPlatformAdmin(session.platform_admin);

    const preferred = session.memberships.find((m) => m.is_default && m.status === 'active');
    if (arrivingRef.current && preferred && session.organization?.slug !== preferred.slug) {
      setActiveOrg(preferred.slug);
      return false;
    }
    arrivingRef.current = false;

    if (session.organization) {
      setActiveOrg(session.organization.slug);
      setOrganization(session.organization);
      setUser(session.user);
      return true;
    }

    const active = session.memberships.filter((m) => m.status === 'active');
    if (active.length === 1 && session.invitations.length === 0 && !session.platform_admin) {
      // One organization and nothing else: no picker, just go in.
      setActiveOrg(active[0]!.slug);
      return false;
    }

    clearActiveOrg();
    setOrganization(null);
    setUser(session.user);
    return true;
  }, []);

  const loadSession = useCallback(async () => {
    let session = (await apiClient.get<ApiOk<SessionResponse>>('/auth/session')).data;
    // Chosen just now (a single membership): read it again, inside it.
    if (!applySession(session)) {
      session = (await apiClient.get<ApiOk<SessionResponse>>('/auth/session')).data;
      applySession(session);
    }
    return session;
  }, [applySession]);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [impersonated, setImpersonated] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Boot: config and session in parallel. A 401 on session is the normal
  // "signed out" case, not an error.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const [configResult, sessionResult] = await Promise.allSettled([
        apiClient.get<ApiOk<AuthConfig>>('/auth/config'),
        loadSession(),
      ]);

      if (cancelled) return;

      if (configResult.status === 'fulfilled') {
        setConfig(configResult.value.data);
      } else {
        const reason = configResult.reason;
        setStatusMessage(
          reason instanceof ApiRequestError ? reason.message : 'The server did not respond.',
        );
        setStatus('error');
        return;
      }

      if (sessionResult.status === 'fulfilled') {
        setStatus('authenticated');
        return;
      }

      // A 401 is the normal signed-out case. Anything else is a real fault,
      // and its message is the only clue the operator gets.
      const reason = sessionResult.reason;
      const isFault = reason instanceof ApiRequestError && reason.status !== 401;

      if (isFault) {
        setStatusMessage(reason.message);
        setStatus('error');
        return;
      }

      setStatus('unauthenticated');
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  // Once a tab is inside an organization, say so -- once per load. The API
  // logs it there once per sign-in, and answers whether this is the person's
  // first visit ever, which offers them the tour.
  const enteredSlug = organization?.slug ?? null;
  useEffect(() => {
    if (!enteredSlug) return;
    apiClient
      .post<ApiOk<{ first_visit: boolean }>>('/auth/enter')
      .then((response) => setFirstVisit(response.data.first_visit))
      .catch(() => undefined);
  }, [enteredSlug]);

  // The organization this tab named may not be entered any more (archived, or
  // the person was removed): back to choosing.
  useEffect(() => {
    function handleOrganizationRequired() {
      if (!getActiveOrg()) return;
      clearActiveOrg();
      queryClient.clear();
      setOrganization(null);
      window.location.assign('/select-organization');
    }

    window.addEventListener(ORGANIZATION_REQUIRED_EVENT, handleOrganizationRequired);
    return () => window.removeEventListener(ORGANIZATION_REQUIRED_EVENT, handleOrganizationRequired);
  }, [queryClient]);

  const chooseOrganization = useCallback(
    (slug: string) => {
      setActiveOrg(slug);
      // A full reload: the brand, every cached query, the onboarding state and
      // the dashboards all start clean, in the new organization.
      queryClient.clear();
      window.location.assign('/');
    },
    [queryClient],
  );

  const refreshSession = useCallback(async () => {
    await loadSession();
  }, [loadSession]);

  // Any 401 from anywhere in the app drops us back to signed-out.
  useEffect(() => {
    function handleUnauthenticated() {
      setUser(null);
      setImpersonated(false);
      setStatus('unauthenticated');
    }

    window.addEventListener(UNAUTHENTICATED_EVENT, handleUnauthenticated);
    return () => window.removeEventListener(UNAUTHENTICATED_EVENT, handleUnauthenticated);
  }, []);

  const signInWithGoogle = useCallback(
    async (credential: string) => {
      setError(null);

      try {
        await apiClient.post<ApiOk<SessionResponse>>('/auth/google', {
          credential,
        });

        // Read the session again, inside the organization this browser last
        // used when the person may still enter it.
        await loadSession();
        setStatus('authenticated');
      } catch (caught) {
        setStatus('unauthenticated');
        setError(
          caught instanceof ApiRequestError
            ? caught
            : new ApiRequestError(0, 'internal_error', 'Sign-in failed. Please try again.'),
        );
      }
    },
    [loadSession],
  );

  const signOut = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Server data was fetched as the previous user; none of it should survive.
      queryClient.clear();
      clearActiveOrg();
      // The next sign-in arrives afresh, and lands in their default.
      arrivingRef.current = true;
      setUser(null);
      setOrganization(null);
      setMemberships([]);
      setInvitations([]);
      setPlatformAdmin(false);
      setImpersonated(false);
      setError(null);
      setStatus('unauthenticated');
    }
  }, [queryClient]);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      status,
      user,
      organization,
      memberships,
      invitations,
      platformAdmin,
      firstVisit,
      chooseOrganization,
      refreshSession,
      config,
      impersonated,
      onboarding,
      setOnboarding,
      error,
      statusMessage,
      signInWithGoogle,
      signOut,
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
      refreshSession,
      config,
      impersonated,
      onboarding,
      error,
      statusMessage,
      signInWithGoogle,
      signOut,
      clearError,
    ],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/**
 * The clock this organization records its lessons against. Every "today" the
 * page works out is on it, never on the browser's own zone.
 */
export function useOrgTimeZone(): string {
  const { organization } = useAuth();
  return organization?.time_zone ?? DEFAULT_ORG_TIME_ZONE;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}
