import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiOk, AuthConfig, SessionResponse, User } from '@tmi/shared';

import { ApiRequestError, UNAUTHENTICATED_EVENT, apiClient } from '@/lib/api-client';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** Public auth config from the Worker; null until it loads. */
  config: AuthConfig | null;
  /** True when the API is running with AUTH_ENABLED=false. */
  impersonated: boolean;
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
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [impersonated, setImpersonated] = useState(false);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Boot: config and session in parallel. A 401 on session is the normal
  // "signed out" case, not an error.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const [configResult, sessionResult] = await Promise.allSettled([
        apiClient.get<ApiOk<AuthConfig>>('/auth/config'),
        apiClient.get<ApiOk<SessionResponse>>('/auth/session'),
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
        setUser(sessionResult.value.data.user);
        setImpersonated(sessionResult.value.data.impersonated);
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
  }, []);

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
        const response = await apiClient.post<ApiOk<SessionResponse>>('/auth/google', {
          credential,
        });

        setUser(response.data.user);
        setImpersonated(response.data.impersonated);
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
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Server data was fetched as the previous user; none of it should survive.
      queryClient.clear();
      setUser(null);
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
      config,
      impersonated,
      error,
      statusMessage,
      signInWithGoogle,
      signOut,
      clearError,
    }),
    [status, user, config, impersonated, error, statusMessage, signInWithGoogle, signOut, clearError],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }

  return context;
}
