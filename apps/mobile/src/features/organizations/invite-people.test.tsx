import { inviteRowRequest } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { InvitePeople, inviteProblem } from './invite-people';

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
jest.mock('@/lib/server', () => ({ serverOrigin: () => 'http://localhost:8787' }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockInvite = jest.fn();
jest.mock('./api', () => ({ useInvitePerson: () => ({ mutateAsync: mockInvite, isPending: false }) }));
// The code card has its own tests; here it is only there.
jest.mock('./space-code-card', () => {
  const { View } = jest.requireActual('react-native');
  return { SpaceCodePanel: () => <View testID="space-code" /> };
});

function as(org: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({
    user: { full_name: 'Mia Creator', roles: ['admin', 'parent'] },
    organization: { slug: 's-abcd2345', name: 'The Creator family', feature_tutoring: false, ...org },
  });
}

beforeEach(() => jest.clearAllMocks());

describe('InvitePeople (Phase 61, S12)', () => {
  it('offers Admin and Parent in a newcomer’s space, and Tutor only where Tutoring is allowed', async () => {
    as();
    await renderWithProviders(<InvitePeople onDone={jest.fn()} />);
    expect(screen.getByTestId('invite-role-0-admin')).toBeTruthy();
    expect(screen.getByTestId('invite-role-0-parent')).toBeTruthy();
    expect(screen.queryByTestId('invite-role-0-tutor')).toBeNull();
    expect(screen.getByTestId('space-code')).toBeTruthy();
    await screen.unmount();

    as({ feature_tutoring: true });
    await renderWithProviders(<InvitePeople onDone={jest.fn()} />);
    expect(screen.getByTestId('invite-role-0-tutor')).toBeTruthy();
  });

  it('checks a row on the device, sending nothing for a bad email', async () => {
    as();
    await renderWithProviders(<InvitePeople onDone={jest.fn()} />);
    expect(screen.getByTestId('invite-send')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('invite-email-0'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('invite-send'));
    expect(await screen.findByTestId('invite-problem-0')).toHaveTextContent('Enter a valid email address.');
    expect(mockInvite).not.toHaveBeenCalled();
    expect(screen.getByTestId('invite-skip')).toBeTruthy();
  });

  it('sends each row as the ordinary add-person request, keeps a refused one, and shares the sent', async () => {
    as();
    const onDone = jest.fn();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    mockInvite.mockImplementation(async (row: { email: string }) => {
      if (row.email === 'taken@example.com') throw new ApiRequestError(409, 'conflict', 'Already here.');
      return { data: {} };
    });
    await renderWithProviders(<InvitePeople onDone={onDone} />);
    await fireEvent.changeText(screen.getByTestId('invite-email-0'), 'Maria.Lopez@Example.com');
    await fireEvent.press(screen.getByTestId('invite-role-0-admin'));
    await fireEvent.press(screen.getByTestId('invite-add-row'));
    await fireEvent.changeText(screen.getByTestId('invite-email-1'), 'taken@example.com');
    await fireEvent.changeText(screen.getByTestId('invite-name-1'), 'Tom Taken');
    await fireEvent.press(screen.getByTestId('invite-send'));

    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Invitation made.'));
    expect(mockInvite).toHaveBeenCalledWith({ email: 'maria.lopez@example.com', full_name: undefined, role: 'admin' });
    expect(inviteRowRequest(mockInvite.mock.calls[0][0])).toEqual({
      email: 'maria.lopez@example.com',
      full_name: 'Maria Lopez',
      roles: ['admin'],
      status: 'invited',
    });
    // The refused row stays, with its reason; the sent one moves to INVITED.
    expect(screen.getByTestId('invite-problem-0')).toHaveTextContent('Already in this space.');
    expect(screen.getByText('INVITED')).toBeTruthy();
    expect(screen.getByTestId('invite-text-maria.lopez@example.com')).toHaveTextContent(
      'Mia Creator invited you to The Creator family on Aimtrue. Sign in at http://localhost:8787 with maria.lopez@example.com.',
    );
    await fireEvent.press(screen.getByTestId('invite-share-maria.lopez@example.com'));
    expect(share).toHaveBeenCalledWith({
      message:
        'Mia Creator invited you to The Creator family on Aimtrue. Sign in at http://localhost:8787 with maria.lopez@example.com.',
    });
    await fireEvent.press(screen.getByTestId('invite-continue'));
    expect(onDone).toHaveBeenCalled();
    share.mockRestore();
  });

  it('says the server’s field error, or its message, for any other refusal', () => {
    expect(inviteProblem(new ApiRequestError(422, 'validation_failed', 'Check the form.', { email: ['Bad email.'] }))).toBe(
      'Bad email.',
    );
    expect(inviteProblem(new ApiRequestError(422, 'validation_failed', 'Check the form.', { roles: ['No such role.'] }))).toBe(
      'No such role.',
    );
    expect(inviteProblem(new ApiRequestError(429, 'rate_limited', 'Try again in 42 seconds.'))).toBe('Try again in 42 seconds.');
    expect(inviteProblem(new Error('offline'))).toBe('Could not invite them. Try again.');
  });
});
