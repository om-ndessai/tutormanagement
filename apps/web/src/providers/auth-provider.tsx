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
import { DEFAULT_ORG_TIME_ZONE, arrivalFromGuest, decideLanding } from '@tmi/shared';
import { guestMemory } from '@/features/guest/guest-store';
import type {
  MyJoinRequest,
  PlatformAccount,
  SignupInput,
  SignupStart,
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
import {
  clearActiveOrg,
  forgetTabOrgEntered,
  getTabOrg,
  isOpeningTabOrg,
  markTabOrgEntered,
  setActiveOrg,
  takeLinkedOrg,
} from '@/lib/organization';

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
  /** Phase 52: a self-registered person's age band; null for anyone a space added. */
  account: PlatformAccount | null;
  /** Phase 52: their own open (or just declined) requests to join a space. */
  joinRequests: MyJoinRequest[];
  /** Phase 63 (P13): the person may delete their account now (their own space goes with it). */
  accountDeletable: boolean;
  /** Phase 72 (JF12): someone a space added accepts the terms and the privacy notice once, at first sign-in. */
  legalDue: boolean;
  /**
   * Phase 80 (A12): a self-signed-up person placed in a space when approved is offered a space of their own, until
   * they make one or say no thanks.
   */
  personalSpaceOffer: boolean;
  /**
   * Phase 52: a newcomer between their Google sign-in and the age question -- who Google says they
   * are, and the short-lived token that stands for it. Held in memory only.
   */
  pendingSignup: SignupStart['signup'] | null;
  /** Phase 52: answers the age question and the terms, and signs the newcomer in. */
  completeSignup: (input: Omit<SignupInput, 'token'>) => Promise<void>;
  /**
   * Drops a sign-up that was refused (too young, waiting, declined, not on the list), so the guest page does not
   * reopen its form by itself (UI audit J05 step 11). The app has had the same since Phase 52.
   */
  cancelSignup: () => void;
  /** True the first time this person has ever opened this organization. */
  firstVisit: boolean;
  /**
   * The space a link named (`?org=`) that this tab has not entered yet. The sign-in page carries it
   * through a redirect provider's round trip, which reloads the page and would otherwise lose it (S4).
   */
  pendingLink: string | null;
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
/**
 * Phase 55: reads (and clears) what a redirect sign-in left in the address's
 * fragment: `signup=<token>&email&name`, `auth_error=<code>&message`, or
 * `linked=<provider>`.
 */
function takeRedirectOutcome(): { signup?: SignupStart['signup']; error?: ApiRequestError } | null {
  if (typeof window === 'undefined' || window.location.hash.length < 2) return null;
  const values = new URLSearchParams(window.location.hash.slice(1));
  const token = values.get('signup');
  const code = values.get('auth_error');
  if (!token && !code && !values.get('linked')) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return {
    ...(token ? { signup: { token, email: values.get('email') ?? '', name: values.get('name') ?? '' } } : {}),
    ...(code
      ? { error: new ApiRequestError(401, code as never, values.get('message') ?? 'Sign-in failed. Please try again.') }
      : {}),
  };
}

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
  const [accountDeletable, setAccountDeletable] = useState(false);
  const [legalDue, setLegalDue] = useState(false);
  const [personalSpaceOffer, setPersonalSpaceOffer] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<SignupStart['signup'] | null>(null);
  const [firstVisit, setFirstVisit] = useState(false);

  /**
   * Takes in what the server says about the session, and decides which space this tab is in.
   *
   * A tab with a space of its own (chosen, switched to, or entered, in sessionStorage) stays in
   * it while the person may still enter it -- two tabs may sit in two spaces. A tab ARRIVING with
   * none (just signed in, freshly opened, or back from a space it could no longer enter) lands by
   * the Phase 60 rule (`decideLanding`, docs/spaces-plan.md S4): a link naming a space, then the
   * last space the person chose on any device (the server's, ahead of the browser's own cookie),
   * then their only space when nothing is pending; otherwise nothing is chosen and the selector
   * asks. Answers false when it chose a space and the session must be read again inside it.
   */
  // A link that names a space (a notification email's, a calendar or share link) is read once,
  // when the tab opens, and enters that space if the person may.
  const linkedRef = useRef<string | null | undefined>(undefined);
  if (linkedRef.current === undefined) linkedRef.current = takeLinkedOrg();
  const [pendingLink, setPendingLink] = useState<string | null>(() => linkedRef.current ?? null);
  const consumeLink = useCallback(() => {
    linkedRef.current = null;
    setPendingLink(null);
  }, []);

  const applySession = useCallback((session: SessionResponse): boolean => {
    setImpersonated(session.impersonated);
    setOnboarding(session.onboarding);
    setMemberships(session.memberships);
    setInvitations(session.invitations);
    setPlatformAdmin(session.platform_admin);
    setAccount(session.account ?? null);
    setJoinRequests(session.join_requests ?? []);
    setAccountDeletable(session.account_deletable === true);
    setLegalDue(session.legal_due === true);
    setPersonalSpaceOffer(session.personal_space_offer === true);

    // The link is kept until the tab is in its space (or it cannot be entered): two loads racing
    // at boot must both honour it.
    const linked = linkedRef.current;
    const own = getTabOrg();
    const here = session.organization?.slug ?? null;

    let target: string | null;
    if (linked && session.memberships.some((m) => m.slug === linked && m.status === 'active')) {
      target = linked;
      // A link opens its space, even the one this tab is in: it becomes the last choice (S4).
      forgetTabOrgEntered();
      if (here === linked) consumeLink();
    } else if (own && own === here) {
      consumeLink();
      target = own;
    } else {
      consumeLink();
      // Arriving, or the tab's own space can no longer be entered: the landing rule.
      target = decideLanding(session);
    }

    if (target && target === here) {
      setActiveOrg(target);
      setOrganization(session.organization);
      setUser(session.user);
      return true;
    }
    if (target) {
      setActiveOrg(target);
      return false;
    }

    clearActiveOrg();
    setOrganization(null);
    setUser(session.user);
    return true;
  }, [consumeLink]);

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
      // Phase 55: a redirect sign-in (Microsoft, Apple, Facebook) comes back with its outcome in
      // the fragment, which never reaches a server: a newcomer's sign-up, or a refusal to show.
      const landed = takeRedirectOutcome();
      if (landed?.signup) setPendingSignup(landed.signup);
      if (landed?.error) setError(landed.error);

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
  // first visit ever, which offers them the tour. Only an OPENING (an arrival, a
  // switch, a choice, a link) moves the person's last choice; a reload or a full
  // navigation of a tab already in it says `opened: false` (Phase 60, S9), so it
  // never takes back what another tab chose since.
  const enteredSlug = organization?.slug ?? null;
  useEffect(() => {
    if (!enteredSlug) return;
    const opened = isOpeningTabOrg(enteredSlug);
    apiClient
      .post<ApiOk<{ first_visit: boolean }>>('/auth/enter', { opened })
      .then((response) => {
        markTabOrgEntered(enteredSlug);
        setFirstVisit(response.data.first_visit);
      })
      .catch(() => undefined);
  }, [enteredSlug]);

  // The organization this tab named may not be entered any more (archived, or
  // the person was removed): back to choosing.
  useEffect(() => {
    function handleOrganizationRequired() {
      if (!getTabOrg()) return;
      clearActiveOrg();
      queryClient.clear();
      setOrganization(null);
      // Back to the landing rule: their other space, or the selector.
      window.location.assign('/');
    }

    window.addEventListener(ORGANIZATION_REQUIRED_EVENT, handleOrganizationRequired);
    return () => window.removeEventListener(ORGANIZATION_REQUIRED_EVENT, handleOrganizationRequired);
  }, [queryClient]);

  const chooseOrganization = useCallback(
    (slug: string) => {
      setActiveOrg(slug);
      // A choice opens the space, even the one this tab is in: it becomes the last choice.
      forgetTabOrgEntered();
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
      // The session ended (signed out in another tab, or expired): this tab's space goes with it,
      // so the next sign-in here arrives afresh and lands by the rule, as after signOut (S4).
      clearActiveOrg();
      setOrganization(null);
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
        // Phase 52: this client can sign a newcomer up, so an unknown account is not refused.
        const answer = await apiClient.post<ApiOk<SessionResponse | SignupStart>>('/auth/google', {
          credential,
          signup: true,
        });
        if ('signup' in answer.data) {
          setPendingSignup(answer.data.signup);
          setStatus('unauthenticated');
          return;
        }

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

  const completeSignup = useCallback(
    async (input: Omit<SignupInput, 'token'>) => {
      await apiClient.post<ApiOk<SessionResponse>>('/auth/signup', {
        // Phase 68 (H4): one word for how they arrived, read from this browser's guest play -- never the tiles.
        arrived_via: arrivalFromGuest(guestMemory.played()),
        ...input,
        ...(pendingSignup ? { token: pendingSignup.token } : {}),
      });
      setPendingSignup(null);
      await loadSession();
      setStatus('authenticated');
    },
    [pendingSignup, loadSession],
  );

  const signOut = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Server data was fetched as the previous user; none of it should survive.
      queryClient.clear();
      // The next sign-in arrives afresh, and lands by the rule (their last space, on any device).
      clearActiveOrg();
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
  const cancelSignup = useCallback(() => setPendingSignup(null), []);

  const value = useMemo(
    () => ({
      status,
      user,
      organization,
      memberships,
      invitations,
      platformAdmin,
      account,
      joinRequests,
      accountDeletable,
      legalDue,
      personalSpaceOffer,
      pendingSignup,
      completeSignup,
      cancelSignup,
      firstVisit,
      pendingLink,
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
      account,
      joinRequests,
      accountDeletable,
      legalDue,
      personalSpaceOffer,
      pendingSignup,
      completeSignup,
      cancelSignup,
      firstVisit,
      pendingLink,
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
