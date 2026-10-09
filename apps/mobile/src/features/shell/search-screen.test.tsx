import { act, fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { SearchScreen } from './search-screen';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissAll: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
}));
const mockUseUsers = jest.fn();
jest.mock('@/features/users/api', () => ({
  useUsers: (params: unknown, options: unknown) => mockUseUsers(params, options),
}));

const membership = (slug: string, name: string) => ({ slug, name, status: 'active', roles: ['tutor'] });

function auth(roles: string[], extra: Record<string, unknown> = {}) {
  return {
    user: { id: 'me', full_name: 'Me', roles },
    organization: { slug: 'chmi' },
    memberships: [membership('chmi', 'Chapel Hill'), membership('riverside', 'Riverside Tutoring')],
    platformAdmin: false,
    chooseOrganization: jest.fn(() => Promise.resolve()),
    signOut: jest.fn(),
    ...extra,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockUseUsers.mockReturnValue({ data: undefined, isFetching: false });
});
afterEach(() => jest.useRealTimers());

describe('SearchScreen', () => {
  it('never offers Organization to a non-admin', async () => {
    mockAuth.mockReturnValue(auth(['tutor']));
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByTestId('search-goto-nav-billing')).toBeTruthy();
    expect(screen.queryByTestId('search-goto-nav-organization')).toBeNull();
    // "organization" still finds the switch actions; "payer" is the Organization page's alone.
    await fireEvent.changeText(screen.getByTestId('search-input'), 'organization');
    expect(screen.queryByTestId('search-goto-nav-organization')).toBeNull();
    expect(screen.getByTestId('search-action-org-riverside')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'payer');
    await act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByTestId('search-empty')).toBeTruthy();
    expect(screen.getByText('Nothing matches “payer”.')).toBeTruthy();
  });

  it('offers Organization to an admin, and narrows destinations as you type', async () => {
    mockAuth.mockReturnValue(auth(['admin', 'tutor']));
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByTestId('search-goto-nav-organization')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('search-input'), 'bill');
    expect(screen.getByTestId('search-goto-nav-billing')).toBeTruthy();
    expect(screen.queryByTestId('search-goto-nav-sessions')).toBeNull();
  });

  it('asks for people only from two characters, and lists them with their roles', async () => {
    mockAuth.mockReturnValue(auth(['tutor']));
    await renderWithProviders(<SearchScreen />);
    await fireEvent.changeText(screen.getByTestId('search-input'), 's');
    await act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockUseUsers).toHaveBeenLastCalledWith(
      { search: undefined, limit: 6, sort: 'full_name' },
      { enabled: false },
    );
    mockUseUsers.mockReturnValue({
      data: { data: [{ id: 'sofia', full_name: 'Sofia Okafor', roles: ['student'] }] },
      isFetching: false,
    });
    await fireEvent.changeText(screen.getByTestId('search-input'), 'sof');
    await act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(mockUseUsers).toHaveBeenLastCalledWith(
      { search: 'sof', limit: 6, sort: 'full_name' },
      { enabled: true },
    );
    expect(screen.getByTestId('search-person-sofia')).toBeTruthy();
    expect(screen.getByText('Student')).toBeTruthy();
  });

  it('offers the other organizations only, and the console only to a platform admin', async () => {
    mockAuth.mockReturnValue(auth(['tutor']));
    const { unmount } = await renderWithProviders(<SearchScreen />);
    expect(screen.getByTestId('search-action-org-riverside')).toBeTruthy();
    expect(screen.queryByTestId('search-action-org-chmi')).toBeNull();
    expect(screen.queryByTestId('search-action-platform')).toBeNull();
    expect(screen.getByTestId('search-action-theme-dark')).toBeTruthy();
    unmount();
    mockAuth.mockReturnValue(auth(['tutor'], { platformAdmin: true }));
    await renderWithProviders(<SearchScreen />);
    expect(screen.getByTestId('search-action-platform')).toBeTruthy();
  });
});
