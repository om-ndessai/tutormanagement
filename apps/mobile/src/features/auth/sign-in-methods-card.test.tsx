// Phase 55: My profile's "Ways to sign in".
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { addableProviders, SignInMethodsCard } from './sign-in-methods-card';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
    delete: (path: string) => mockDelete(path),
  },
}));
const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth(), useOrgTimeZone: () => 'America/New_York' }));
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
const mockProviderToken = jest.fn();
jest.mock('@/lib/provider-sign-in', () => ({
  ...jest.requireActual('@/lib/provider-sign-in'),
  providerToken: (p: unknown) => mockProviderToken(p),
}));

const MS = { id: 'microsoft', label: 'Microsoft', clientId: 'ms' };
const GOOGLE_ROW = { provider: 'google', email_at_link: 'alex@example.com', created_at: '2026-10-01T00:00:00Z', last_used_at: '2026-10-20T14:00:00Z' };
const MS_ROW = { provider: 'microsoft', email_at_link: null, created_at: '2026-10-02T00:00:00Z', last_used_at: null };

function signedIn(extra: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({ config: { auth_enabled: true }, impersonated: false, providers: [MS], googleAvailable: true, ...extra });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('addableProviders', () => {
  it('offers what is offered, not linked, and usable here', () => {
    const data = { identities: [GOOGLE_ROW as never], offered: ['google', 'microsoft', 'facebook'] as never };
    expect(addableProviders(data, { google: true, others: ['microsoft'] })).toEqual(['microsoft']);
    expect(addableProviders(data, { google: true, others: [] })).toEqual([]);
  });
});

describe('SignInMethodsCard', () => {
  it('is hidden while sign-in is off, and asks for nothing', async () => {
    mockAuth.mockReturnValue({ config: { auth_enabled: false }, impersonated: true, providers: [], googleAvailable: false });
    await renderWithProviders(<SignInMethodsCard />);
    expect(screen.queryByTestId('sign-in-methods')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('lists the ways in; the last one cannot be removed', async () => {
    signedIn();
    mockGet.mockResolvedValue({ data: { identities: [GOOGLE_ROW], offered: ['google', 'microsoft'] } });
    await renderWithProviders(<SignInMethodsCard />);
    expect(await screen.findByTestId('sign-in-method-google')).toBeTruthy();
    expect(screen.getByText('alex@example.com')).toBeTruthy();
    expect(screen.getByText(/^Last used /)).toBeTruthy();
    expect(screen.getByTestId('sign-in-method-remove-google')).toBeDisabled();
    expect(screen.getByTestId('sign-in-method-add-microsoft')).toBeTruthy();
    expect(screen.queryByTestId('sign-in-method-add-google')).toBeNull();
  });

  it('removes one of two, and says the server’s refusal in its words', async () => {
    signedIn();
    mockGet.mockResolvedValue({ data: { identities: [GOOGLE_ROW, MS_ROW], offered: ['google', 'microsoft'] } });
    mockDelete.mockResolvedValueOnce({ data: [GOOGLE_ROW] });
    await renderWithProviders(<SignInMethodsCard />);
    expect(await screen.findByText('Not used yet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('sign-in-method-remove-microsoft'));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Microsoft removed.'));
    expect(mockDelete).toHaveBeenCalledWith('/auth/identities/microsoft');

    mockDelete.mockRejectedValueOnce(new ApiRequestError(409, 'conflict', 'Keep at least one way to sign in.'));
    await fireEvent.press(screen.getByTestId('sign-in-method-remove-google'));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith('Keep at least one way to sign in.'));
  });

  it('adds Microsoft by signing in with it once', async () => {
    signedIn();
    mockGet.mockResolvedValue({ data: { identities: [GOOGLE_ROW], offered: ['google', 'microsoft'] } });
    mockProviderToken.mockResolvedValue({ kind: 'token', body: { id_token: 'ms-token' } });
    mockPost.mockResolvedValue({ data: [GOOGLE_ROW, MS_ROW] });
    await renderWithProviders(<SignInMethodsCard />);
    await fireEvent.press(await screen.findByTestId('sign-in-method-add-microsoft'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/auth/identities/microsoft', { id_token: 'ms-token' }));
    expect(mockProviderToken).toHaveBeenCalledWith(MS);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Microsoft added to your ways to sign in.'));
  });

  it('says nothing when the browser is closed', async () => {
    signedIn();
    mockGet.mockResolvedValue({ data: { identities: [GOOGLE_ROW], offered: ['google', 'microsoft'] } });
    mockProviderToken.mockResolvedValue({ kind: 'cancelled' });
    await renderWithProviders(<SignInMethodsCard />);
    await fireEvent.press(await screen.findByTestId('sign-in-method-add-microsoft'));
    await waitFor(() => expect(mockProviderToken).toHaveBeenCalled());
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});
