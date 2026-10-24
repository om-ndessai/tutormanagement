// Google sign-in in the auth provider (G1), with the native library mocked and the server faked
// at fetch: the session cookie is a flag the fake sets on POST /auth/google and clears on logout.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';

import { apiClient } from '@/lib/api-client';
import { emit } from '@/lib/events';
import { clearActiveOrg, getActiveOrg } from '@/lib/organization';
import { setDevUser } from '@/lib/server';

import { AuthProvider, useAuth } from './auth-provider';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        variant: 'development',
        googleIosClientId: 'ios-id.apps.googleusercontent.com',
        googleWebClientId: 'fallback-web-id.apps.googleusercontent.com',
      },
    },
  },
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(),
    signInSilently: jest.fn(),
    signOut: jest.fn(async () => null),
    hasPreviousSignIn: jest.fn(() => false),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
  isErrorWithCode: (error: unknown) =>
    typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string',
  GoogleSigninButton: () => null,
}));

type GoogleMock = Record<
  'configure' | 'hasPlayServices' | 'signIn' | 'signInSilently' | 'signOut' | 'hasPreviousSignIn',
  jest.Mock
>;
const { GoogleSignin } = jest.requireMock('@react-native-google-signin/google-signin') as {
  GoogleSignin: GoogleMock;
};

const ORG = { id: 'org-1', slug: 'chmi', name: 'Org', time_zone: 'America/New_York', settings: null };
const PERSON = { id: 'u1', email: 'priya.raghavan@gmail.com', full_name: 'Priya Raghavan', roles: [] };

/** The fake server. `cookie` stands for the tmi_session cookie the platform keeps. */
const server = {
  cookie: false,
  noAccount: false,
  calls: [] as { method: string; path: string; init: RequestInit }[],
};

function json(status: number, body: unknown) {
  return Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: () => Promise.resolve(body),
  } as Response);
}
const unauthenticated = () =>
  json(401, { error: { code: 'unauthenticated', message: 'Sign in to continue.' } });

function fakeFetch(url: string, init: RequestInit = {}) {
  const path = url.replace(/^.*\/api/, '');
  const method = init.method ?? 'GET';
  server.calls.push({ method, path, init });
  const headers = (init.headers ?? {}) as Record<string, string>;
  if (path === '/auth/config') {
    return json(200, {
      data: { auth_enabled: true, google_client_id: 'web-id.apps.googleusercontent.com', brand: null },
    });
  }
  if (path === '/auth/google') {
    if (server.noAccount) {
      return json(403, {
        error: {
          code: 'no_account',
          message: 'You are not authorized to access this portal. Please reach out to the administrator.',
        },
      });
    }
    server.cookie = true;
    return json(200, { data: {} });
  }
  if (path === '/auth/logout') {
    server.cookie = false;
    return Promise.resolve({ status: 204, ok: true, json: () => Promise.resolve(null) } as Response);
  }
  if (!server.cookie) return unauthenticated();
  if (path === '/auth/session') {
    const inOrg = headers['X-Organization'] === 'chmi';
    return json(200, {
      data: {
        user: PERSON,
        impersonated: false,
        onboarding: null,
        organization: inOrg ? ORG : null,
        memberships: [{ slug: 'chmi', name: 'Org', status: 'active', is_default: false }],
        invitations: [],
        platform_admin: false,
      },
    });
  }
  if (path === '/auth/enter') return json(200, { data: { first_visit: false } });
  if (path === '/dashboard') return json(200, { data: { ok: true } });
  return json(404, { error: { code: 'not_found', message: 'Not found.' } });
}

let auth: ReturnType<typeof useAuth>;
function Probe() {
  const value = useAuth();
  // Handed out after each render (the test reads the latest), never during it.
  useEffect(() => {
    auth = value;
  });
  return null;
}

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(auth.status).not.toBe('loading'));
  return client;
}

const calls = (path: string) => server.calls.filter((call) => call.path === path);

beforeEach(async () => {
  server.cookie = false;
  server.noAccount = false;
  server.calls = [];
  globalThis.fetch = jest.fn(fakeFetch) as unknown as typeof fetch;
  Object.values(GoogleSignin).forEach((mock) => mock.mockClear());
  GoogleSignin.hasPreviousSignIn.mockReturnValue(false);
  clearActiveOrg();
  await setDevUser(null);
});

describe('auth provider: Google sign-in', () => {
  it('boots signed out without a cookie, configured for the server’s web client', async () => {
    await mount();
    expect(auth.status).toBe('unauthenticated');
    expect(auth.googleAvailable).toBe(true);
    expect(GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: 'web-id.apps.googleusercontent.com',
        iosClientId: 'ios-id.apps.googleusercontent.com',
      }),
    );
  });

  it('boots signed in when the stored cookie is still good', async () => {
    server.cookie = true;
    await mount();
    expect(auth.status).toBe('authenticated');
    expect(auth.organization?.slug).toBe('chmi');
  });

  it('signs in: Google’s ID token is exchanged at POST /auth/google, then the session is read', async () => {
    GoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token-1' } });
    await mount();

    await act(() => auth.signInWithGoogle());

    expect(JSON.parse(calls('/auth/google')[0]!.init.body as string)).toEqual({ credential: 'id-token-1' });
    expect(auth.status).toBe('authenticated');
    expect(auth.organization?.slug).toBe('chmi');
    expect(auth.error).toBeNull();
    // Identity is the cookie: every request carries it, none names a developer persona.
    for (const call of server.calls) {
      expect(call.init.credentials).toBe('include');
      expect((call.init.headers as Record<string, string>)['X-Dev-User']).toBeUndefined();
    }
  });

  it('shows the server’s refusal for an unknown account, and forgets the Google account', async () => {
    server.noAccount = true;
    GoogleSignin.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'id-token-1' } });
    await mount();

    await act(() => auth.signInWithGoogle());

    expect(auth.status).toBe('unauthenticated');
    expect(auth.error?.code).toBe('no_account');
    expect(auth.error?.message).toMatch(/not authorized to access this portal/);
    expect(GoogleSignin.signOut).toHaveBeenCalled();
  });

  it('says nothing when the person cancels Google’s sheet', async () => {
    GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });
    await mount();

    await act(() => auth.signInWithGoogle());

    expect(calls('/auth/google')).toHaveLength(0);
    expect(auth.error).toBeNull();
    expect(auth.status).toBe('unauthenticated');
  });

  it('treats a cancellation reported as an error code as a cancellation too', async () => {
    GoogleSignin.signIn.mockRejectedValue(
      Object.assign(new Error('cancelled'), { code: 'SIGN_IN_CANCELLED' }),
    );
    await mount();

    await act(() => auth.signInWithGoogle());

    expect(auth.error).toBeNull();
  });

  it('renews an ended session once, silently, and retries the request', async () => {
    server.cookie = true;
    await mount();
    expect(auth.status).toBe('authenticated');

    // The cookie's 12 hours are up; Google still has the account.
    server.cookie = false;
    GoogleSignin.hasPreviousSignIn.mockReturnValue(true);
    GoogleSignin.signInSilently.mockResolvedValue({ type: 'success', data: { idToken: 'id-token-2' } });

    let result: unknown;
    await act(async () => {
      result = await apiClient.get('/dashboard');
    });

    expect(result).toEqual({ data: { ok: true } });
    expect(calls('/dashboard')).toHaveLength(2);
    expect(JSON.parse(calls('/auth/google')[0]!.init.body as string)).toEqual({ credential: 'id-token-2' });
    expect(auth.status).toBe('authenticated');
  });

  it('renews once for several requests that fail together', async () => {
    server.cookie = true;
    await mount();
    server.cookie = false;
    GoogleSignin.hasPreviousSignIn.mockReturnValue(true);
    GoogleSignin.signInSilently.mockResolvedValue({ type: 'success', data: { idToken: 'id-token-3' } });

    await act(async () => {
      await Promise.all([apiClient.get('/dashboard'), apiClient.get('/dashboard')]);
    });

    expect(GoogleSignin.signInSilently).toHaveBeenCalledTimes(1);
    expect(calls('/auth/google')).toHaveLength(1);
  });

  it('signs out when the silent renewal is not possible', async () => {
    server.cookie = true;
    await mount();
    server.cookie = false;
    GoogleSignin.hasPreviousSignIn.mockReturnValue(false);

    await act(async () => {
      await apiClient.get('/dashboard').catch(() => undefined);
    });

    expect(GoogleSignin.signInSilently).not.toHaveBeenCalled();
    expect(calls('/dashboard')).toHaveLength(1);
    expect(auth.status).toBe('unauthenticated');
    expect(auth.user).toBeNull();
  });

  it('signs out of the server and of Google, and clears the cache and the organization', async () => {
    server.cookie = true;
    const client = await mount();
    client.setQueryData(['dashboard'], { secret: true });
    expect(getActiveOrg()).toBe('chmi');

    await act(() => auth.signOut());

    expect(calls('/auth/logout')).toHaveLength(1);
    expect(server.cookie).toBe(false);
    expect(GoogleSignin.signOut).toHaveBeenCalled();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(getActiveOrg()).toBeNull();
    expect(auth.status).toBe('unauthenticated');
    expect(auth.user).toBeNull();
    expect(auth.organization).toBeNull();
  });
});

describe('auth provider: feature sets (Phase 50)', () => {
  it('re-reads the session on a feature_unavailable refusal, at most once in 10 s', async () => {
    server.cookie = true;
    await mount();
    const before = calls('/auth/session').length;
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(1_000_000);
      await act(async () => emit('feature-unavailable'));
      await waitFor(() => expect(calls('/auth/session').length).toBeGreaterThan(before));
      const after = calls('/auth/session').length;
      // Again within 10 s: nothing more.
      now.mockReturnValue(1_005_000);
      await act(async () => emit('feature-unavailable'));
      expect(calls('/auth/session').length).toBe(after);
      // After 10 s: once more.
      now.mockReturnValue(1_011_000);
      await act(async () => emit('feature-unavailable'));
      await waitFor(() => expect(calls('/auth/session').length).toBeGreaterThan(after));
    } finally {
      now.mockRestore();
    }
  });
});
