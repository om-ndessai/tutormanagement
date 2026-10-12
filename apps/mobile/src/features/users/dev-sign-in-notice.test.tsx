import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { DevSignInNotice } from './dev-sign-in-notice';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const priya = { id: 'priya', full_name: 'Priya Raghavan', roles: ['admin', 'tutor'] };

describe('DevSignInNotice', () => {
  it('says the app is acting as the signed-in person while sign-in is off', async () => {
    mockAuth.mockReturnValue({ user: priya, impersonated: true });
    await renderWithProviders(<DevSignInNotice />);
    expect(screen.getByTestId('profile-dev-notice')).toBeTruthy();
    expect(screen.getByText('Developer sign-in')).toBeTruthy();
    expect(screen.getByText(/acting as Priya Raghavan\./)).toBeTruthy();
  });

  it('renders nothing on a server with sign-in on', async () => {
    mockAuth.mockReturnValue({ user: priya, impersonated: false });
    await renderWithProviders(<DevSignInNotice />);
    expect(screen.queryByTestId('profile-dev-notice')).toBeNull();
  });
});
