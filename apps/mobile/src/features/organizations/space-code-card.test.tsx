import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { SpaceCodePanel, SpaceDangerPanel } from './space-code-card';

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
const mockRouter = { replace: jest.fn(), dismissAll: jest.fn(), canDismiss: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockCode = jest.fn();
const mockRenew = jest.fn();
const mockJoining = jest.fn();
const mockLeave = jest.fn();
const mockDelete = jest.fn();
jest.mock('./api', () => ({
  useSpaceCode: () => mockCode(),
  useRenewSpaceCode: () => ({ mutate: mockRenew, isPending: false }),
  useSetJoinByCode: () => ({ mutateAsync: mockJoining, isPending: false }),
  useLeaveSpace: () => ({ mutate: mockLeave, isPending: false }),
  useDeleteSpace: () => ({ mutate: mockDelete, isPending: false }),
}));

const leaveOrganization = jest.fn();
const refreshSession = jest.fn(async () => undefined);
function as(createdVia: 'console' | 'self_serve', roles: string[], code: string | null = 'FMXY-2345') {
  mockAuth.mockReturnValue({
    organization: { name: 'Maker Test Space', short_name: 'Maker', created_via: createdVia },
    user: { roles },
    leaveOrganization,
    refreshSession,
  });
  mockCode.mockReturnValue({ data: { data: { code, join_by_code: true } }, isPending: false, isError: false });
}
const pressAlertButton = async (alert: jest.SpyInstance, text: string) => {
  const buttons = alert.mock.calls.at(-1)![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
};

beforeEach(() => jest.clearAllMocks());

describe('SpaceCodePanel (Phase 52)', () => {
  it('shows the code, read out a character at a time, and shares the invitation with the address', async () => {
    as('self_serve', ['admin']);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await renderWithProviders(<SpaceCodePanel />);
    expect(screen.getByTestId('space-code-value')).toHaveTextContent('FMXY-2345');
    expect(screen.getByLabelText('Code F M X Y, 2 3 4 5')).toBeTruthy();
    expect(screen.queryByTestId('space-code-copy')).toBeNull();
    await fireEvent.press(screen.getByTestId('space-code-share'));
    expect(share).toHaveBeenCalledWith({
      message: expect.stringMatching(/^Join Maker Test Space on Aimtrue with the code FMXY-2345\. https?:\/\//),
    });
    share.mockRestore();
  });

  it('asks before making a new code when one exists; not before the first', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    as('self_serve', ['admin']);
    await renderWithProviders(<SpaceCodePanel />);
    await fireEvent.press(screen.getByTestId('space-code-renew'));
    expect(mockRenew).not.toHaveBeenCalled();
    await pressAlertButton(alert, 'Make it');
    expect(mockRenew).toHaveBeenCalled();
    mockRenew.mock.calls[0][1].onSuccess();
    expect(mockToast.success).toHaveBeenCalledWith('New code made. The old one no longer works.');
    alert.mockRestore();
  });

  it('makes the first code without asking', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    as('self_serve', ['admin'], null);
    await renderWithProviders(<SpaceCodePanel />);
    expect(screen.getByText('No code yet. Make one to let people ask to join.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('space-code-renew'));
    expect(alert).not.toHaveBeenCalled();
    expect(mockRenew).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('switches joining by code', async () => {
    as('self_serve', ['admin']);
    mockJoining.mockResolvedValue({});
    await renderWithProviders(<SpaceCodePanel />);
    await fireEvent(screen.getByTestId('space-code-joining'), 'valueChange', false);
    expect(mockJoining).toHaveBeenCalledWith(false);
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('Joining by code is off.'));
  });
});

describe('SpaceDangerPanel (Phase 52)', () => {
  it('leaves behind a confirm, and says the server’s refusal for the last admin', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    as('console', ['admin']);
    await renderWithProviders(<SpaceDangerPanel />);
    await fireEvent.press(screen.getByTestId('space-leave'));
    expect(mockLeave).not.toHaveBeenCalled();
    await pressAlertButton(alert, 'Leave');
    expect(mockLeave).toHaveBeenCalled();
    mockLeave.mock.calls[0][1].onError(new ApiRequestError(409, 'conflict', 'You are the only administrator.'));
    expect(mockToast.error).toHaveBeenCalledWith('You are the only administrator.');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await act(async () => mockLeave.mock.calls[0][1].onSuccess());
    expect(leaveOrganization).toHaveBeenCalled();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    alert.mockRestore();
  });

  it.each([
    ['console', ['admin']],
    ['self_serve', ['parent']],
  ] as const)('offers no delete in a %s space to %j', async (via, roles) => {
    as(via, [...roles]);
    await renderWithProviders(<SpaceDangerPanel />);
    expect(screen.getByTestId('space-leave')).toBeTruthy();
    expect(screen.queryByTestId('space-delete')).toBeNull();
  });

  it('offers deleting a self-serve space to its admin, once its name is typed', async () => {
    as('self_serve', ['admin']);
    await renderWithProviders(<SpaceDangerPanel />);
    expect(screen.getByTestId('space-delete')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('space-delete-name'), ' maker test space ');
    expect(screen.getByTestId('space-delete')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('space-delete'));
    expect(mockDelete).toHaveBeenCalledWith(' maker test space ', expect.anything());
  });

  it('deletes on Return only once the name matches', async () => {
    as('self_serve', ['admin']);
    await renderWithProviders(<SpaceDangerPanel />);
    await fireEvent.changeText(screen.getByTestId('space-delete-name'), 'maker');
    await fireEvent(screen.getByTestId('space-delete-name'), 'submitEditing');
    expect(mockDelete).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('space-delete-name'), 'Maker Test Space');
    await fireEvent(screen.getByTestId('space-delete-name'), 'submitEditing');
    expect(mockDelete).toHaveBeenCalledWith('Maker Test Space', expect.anything());
  });

  it('is Leave alone on My profile', async () => {
    as('self_serve', ['admin']);
    await renderWithProviders(<SpaceDangerPanel testID="profile-danger" leaveOnly />);
    expect(screen.getByTestId('profile-danger')).toBeTruthy();
    expect(screen.queryByTestId('space-delete')).toBeNull();
  });
});
