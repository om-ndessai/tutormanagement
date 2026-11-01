import type { Invitation, Membership } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { InvitationBanner } from './invitation-banner';
import { SpacesScreen } from './spaces-screen';
import { invitationsWaiting, resetInvitationBanner } from './spaces-model';

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
const mockRouter = { replace: jest.fn(), push: jest.fn(), dismissAll: jest.fn(), canDismiss: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
// The Welcome below the lists has its own tests (space-welcome.test.tsx).
jest.mock('./space-welcome', () => ({
  SpaceWelcome: ({ firstTime }: { firstTime: boolean }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="welcome">{firstTime ? 'first' : 'again'}</Text>;
  },
}));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockAnswer = jest.fn();
const mockLeave = jest.fn();
jest.mock('./api', () => ({
  useAnswerInvitation: () => ({ mutateAsync: mockAnswer, isPending: false }),
  useLeaveSpace: () => ({ mutateAsync: mockLeave, isPending: false }),
}));

const space = (slug: string, extra: Partial<Membership> = {}): Membership =>
  ({
    slug,
    name: `${slug} Space`,
    short_name: slug,
    palette: 'teal',
    logo_mark_url: null,
    roles: ['tutor'],
    status: 'active',
    is_default: false,
    ...extra,
  }) as Membership;
const invite = (slug: string): Invitation =>
  ({ slug, name: `${slug} Space`, short_name: slug, palette: 'teal', logo_mark_url: null, roles: ['parent'], invited_at: '' }) as Invitation;

const chooseOrganization = jest.fn(async () => undefined);
const refreshSession = jest.fn(async () => undefined);
const reland = jest.fn(async () => undefined);
const signOut = jest.fn(async () => undefined);
function as(over: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({
    user: { full_name: 'Priya Raghavan', email: 'priya@example.com' },
    organization: null,
    memberships: [],
    invitations: [],
    platformAdmin: false,
    chooseOrganization,
    refreshSession,
    reland,
    signOut,
    ...over,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  resetInvitationBanner();
});

describe('SpacesScreen (Phase 60, S5 and S7)', () => {
  it('is "Choose a space" without a frame, with the spaces, no star and Sign out', async () => {
    as({ memberships: [space('chmi'), space('riverside', { is_default: true })] });
    await renderWithProviders(<SpacesScreen />);
    expect(screen.getByTestId('spaces-title')).toHaveTextContent('Choose a space');
    expect(screen.getByTestId('spaces-subtitle')).toHaveTextContent(
      'Signed in as priya@example.com. You land in the space you opened last. Each tab can be in a different one.',
    );
    expect(screen.getByText('YOUR SPACES')).toBeTruthy();
    expect(screen.getByTestId('org-chmi')).toBeTruthy();
    expect(screen.queryByText('Default')).toBeNull();
    expect(screen.queryByText(/on sign-in/)).toBeNull();
    expect(screen.queryByText('Here now')).toBeNull();
    expect(screen.getByTestId('spaces-sign-out')).toBeTruthy();
    expect(screen.getByTestId('welcome')).toHaveTextContent('again');
  });

  it('is the Welcome with nowhere to go', async () => {
    as();
    await renderWithProviders(<SpacesScreen />);
    expect(screen.getByTestId('welcome-title')).toHaveTextContent('Welcome to Aimtrue');
    expect(screen.getByTestId('spaces-subtitle')).toHaveTextContent(
      'Signed in as priya@example.com. Join a space with its code, or start your own.',
    );
    expect(screen.getByTestId('welcome')).toHaveTextContent('first');
  });

  it('inside a space: no title of its own or Sign out, and the current one is "Here now"', async () => {
    as({ organization: { slug: 'chmi' }, memberships: [space('chmi'), space('riverside')] });
    await renderWithProviders(<SpacesScreen />);
    expect(screen.queryByTestId('spaces-title')).toBeNull();
    expect(screen.queryByTestId('spaces-sign-out')).toBeNull();
    expect(screen.getByTestId('org-here-chmi')).toHaveTextContent('Here now');
    expect(screen.queryByTestId('org-here-riverside')).toBeNull();
  });

  it('opens a space: it is entered (which makes it the last choice), then Home', async () => {
    as({ memberships: [space('chmi'), space('riverside')] });
    await renderWithProviders(<SpacesScreen />);
    await fireEvent.press(screen.getByTestId('org-riverside'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
    expect(chooseOrganization).toHaveBeenCalledWith('riverside');
  });

  it('opens the space it is in too: choosing it again makes it the last choice (as on the web), then Home', async () => {
    as({ organization: { slug: 'chmi' }, memberships: [space('chmi'), space('riverside')] });
    await renderWithProviders(<SpacesScreen />);
    await fireEvent.press(screen.getByTestId('org-chmi'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
    expect(chooseOrganization).toHaveBeenCalledWith('chmi');
  });

  it('accepts an invitation and enters that space at once; declines and re-reads the session', async () => {
    as({ memberships: [space('chmi')], invitations: [invite('assess')] });
    mockAnswer.mockResolvedValue(undefined);
    await renderWithProviders(<SpacesScreen />);
    expect(screen.getByText('INVITATIONS')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('invitation-accept-assess'));
    await waitFor(() => expect(chooseOrganization).toHaveBeenCalledWith('assess'));
    expect(mockAnswer).toHaveBeenCalledWith({ slug: 'assess', accept: true });
    expect(mockToast.success).toHaveBeenCalledWith('You have joined assess Space.');
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');

    jest.clearAllMocks();
    await fireEvent.press(screen.getByTestId('invitation-decline-assess'));
    await waitFor(() => expect(refreshSession).toHaveBeenCalled());
    expect(mockAnswer).toHaveBeenCalledWith({ slug: 'assess', accept: false });
    expect(chooseOrganization).not.toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Invitation to assess Space declined.');
  });

  it('leaves another space behind a confirm; Stay closes it', async () => {
    as({ organization: { slug: 'chmi' }, memberships: [space('chmi'), space('riverside')] });
    mockLeave.mockResolvedValue({ data: { left: true } });
    await renderWithProviders(<SpacesScreen />);
    await fireEvent.press(screen.getByTestId('space-leave-riverside'));
    expect(screen.getByTestId('space-leave-confirm-riverside')).toHaveTextContent(
      /You stop being a member of riverside Space\. Its records of you stay\./,
    );
    await fireEvent.press(screen.getByTestId('space-leave-stay-riverside'));
    expect(screen.queryByTestId('space-leave-confirm-riverside')).toBeNull();
    expect(mockLeave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('space-leave-riverside'));
    expect(screen.getByTestId('space-leave-yes-riverside')).toHaveTextContent('Leave riverside');
    await fireEvent.press(screen.getByTestId('space-leave-yes-riverside'));
    await waitFor(() => expect(refreshSession).toHaveBeenCalled());
    expect(mockLeave).toHaveBeenCalledWith('riverside');
    expect(mockToast.success).toHaveBeenCalledWith('You have left riverside Space.');
    // Inside chmi, which carries on.
    expect(reland).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('leaving the space the app is in lands again by the rule', async () => {
    as({ organization: { slug: 'chmi' }, memberships: [space('chmi'), space('riverside')] });
    mockLeave.mockResolvedValue({ data: { left: true } });
    await renderWithProviders(<SpacesScreen />);
    await fireEvent.press(screen.getByTestId('space-leave-chmi'));
    await fireEvent.press(screen.getByTestId('space-leave-yes-chmi'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(reland).toHaveBeenCalled();
  });

  it('says the server’s refusal for the last admin, under the confirm', async () => {
    as({ organization: { slug: 'chmi' }, memberships: [space('chmi', { roles: ['admin'] })] });
    const message = "You are chmi Space's only administrator. Make someone else an administrator first, or delete the space.";
    mockLeave.mockRejectedValue(new ApiRequestError(409, 'last_admin', message));
    await renderWithProviders(<SpacesScreen />);
    await fireEvent.press(screen.getByTestId('space-leave-chmi'));
    await fireEvent.press(screen.getByTestId('space-leave-yes-chmi'));
    expect(await screen.findByTestId('space-leave-problem-chmi')).toHaveTextContent(message);
    expect(mockToast.error).toHaveBeenCalledWith(message);
    expect(reland).not.toHaveBeenCalled();
  });

  it('links a platform admin to the console', async () => {
    as({ platformAdmin: true, memberships: [space('chmi')] });
    await renderWithProviders(<SpacesScreen />);
    await fireEvent.press(screen.getByTestId('spaces-platform-console'));
    expect(mockRouter.push).toHaveBeenCalledWith('/platform');
  });

  it('shows a suspended space without Open, still with Leave', async () => {
    as({ memberships: [space('chmi', { status: 'suspended' })] });
    await renderWithProviders(<SpacesScreen />);
    expect(screen.getByText('Your access here is suspended.')).toBeTruthy();
    expect(screen.getByTestId('space-leave-chmi')).toBeTruthy();
  });
});

describe('InvitationBanner (Phase 60, S6)', () => {
  it('is nothing without an invitation', async () => {
    as({ organization: { slug: 'chmi' } });
    await renderWithProviders(<InvitationBanner />);
    expect(screen.queryByTestId('invitation-banner')).toBeNull();
  });

  it('says who invited, and Accept enters that space', async () => {
    as({ organization: { slug: 'chmi' }, invitations: [invite('assess'), invite('riverside')] });
    mockAnswer.mockResolvedValue(undefined);
    await renderWithProviders(<InvitationBanner />);
    expect(screen.getByTestId('invitation-banner-text')).toHaveTextContent('assess Space invited you');
    expect(screen.getByTestId('invitation-banner-more')).toHaveTextContent('and 1 more');
    await fireEvent.press(screen.getByTestId('invitation-banner-accept'));
    await waitFor(() => expect(chooseOrganization).toHaveBeenCalledWith('assess'));
    expect(mockToast.success).toHaveBeenCalledWith('You have joined assess Space.');
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('Not now hides it for the app session, until signing out', async () => {
    as({ organization: { slug: 'chmi' }, invitations: [invite('assess')] });
    await renderWithProviders(<InvitationBanner />);
    await fireEvent.press(screen.getByTestId('invitation-banner-not-now'));
    expect(screen.queryByTestId('invitation-banner')).toBeNull();
    await screen.unmount();
    await renderWithProviders(<InvitationBanner />);
    expect(screen.queryByTestId('invitation-banner')).toBeNull();
    await screen.unmount();
    resetInvitationBanner();
    await renderWithProviders(<InvitationBanner />);
    expect(screen.getByTestId('invitation-banner')).toBeTruthy();
  });
});

describe('invitationsWaiting', () => {
  it('counts in the web switcher’s words', () => {
    expect(invitationsWaiting(1)).toBe('1 invitation waiting');
    expect(invitationsWaiting(3)).toBe('3 invitations waiting');
  });
});
