// Phase 63 (P13): My profile offers "Delete my account" itself while the session says the account may go
// (`account_deletable`: in no space but, perhaps, the person's own personal space, which goes with it) --
// asked first, with the note, then DELETE /api/auth/account and signed out. Otherwise it only says how.
import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { ProfileScreen } from './profile-screen';

const mockDelete = jest.fn(async (_path: string) => undefined);
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: jest.fn(), post: jest.fn(), delete: (path: string) => mockDelete(path) },
}));

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn() } }));

const mockSignOut = jest.fn(async () => undefined);
let mockDeletable = true;
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'me', roles: ['admin'] },
    accountDeletable: mockDeletable,
    signOut: mockSignOut,
  }),
}));

jest.mock('@/components/toast', () => ({
  ...jest.requireActual('@/components/toast'),
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));

// The rest of the screen is other features' (and tested there).
jest.mock('./api', () => ({ useUserDetail: () => ({ data: undefined, isPending: false, error: null, refetch: jest.fn() }) }));
jest.mock('@/features/auth/sign-in-methods-card', () => ({ SignInMethodsCard: () => null }));
jest.mock('@/features/organizations/space-code-card', () => ({ SpaceDangerPanel: () => null }));
jest.mock('@/features/dictation/dictation-control', () => ({ DictationControl: () => null }));
jest.mock('@/features/shell/appearance-control', () => ({ AppearanceControl: () => null }));
jest.mock('@/features/shell/haptics-control', () => ({ HapticsControl: () => null }));
jest.mock('./dev-sign-in-notice', () => ({ DevSignInNotice: () => null }));

beforeEach(() => {
  mockDelete.mockClear();
  mockSignOut.mockClear();
  mockDeletable = true;
});

describe('My profile: Delete my account (Phase 63)', () => {
  it('deletes the account (its own space with it) after asking, then signs out', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Delete')?.onPress?.();
    });
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByTestId('profile-delete-account')).toBeTruthy();
    expect(screen.queryByTestId('profile-delete-account-how')).toBeNull();
    await fireEvent.press(screen.getByTestId('welcome-delete-account'));
    expect(alert).toHaveBeenCalledWith(
      'Delete your account?',
      'Your own space goes with it. Your name, address and sign-in are removed. This cannot be undone.',
      expect.any(Array),
    );
    expect(mockDelete).toHaveBeenCalledWith('/auth/account');
    await screen.findByTestId('profile-delete-account');
    expect(mockSignOut).toHaveBeenCalled();
    alert.mockRestore();
  });

  it('only says how while the person belongs to a space besides their own', async () => {
    mockDeletable = false;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<ProfileScreen />);
    expect(screen.queryByTestId('welcome-delete-account')).toBeNull();
    await fireEvent.press(screen.getByTestId('profile-delete-account-how'));
    expect(alert).toHaveBeenCalledWith('Delete my account', expect.stringContaining('First leave every space'), expect.any(Array));
    expect(mockDelete).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
