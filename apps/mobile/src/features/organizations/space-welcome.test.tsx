import type { MyJoinRequest } from '@tmi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { SpaceWelcome } from './space-welcome';

const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
const mockRouter = { replace: jest.fn(), dismissAll: jest.fn(), canDismiss: jest.fn(() => false) };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'America/New_York' }] }));

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockSeen = jest.fn();
const mockWithdraw = jest.fn();
const mockLookup = jest.fn();
const mockAsk = jest.fn();
const mockMake = jest.fn();
const mockDelete = jest.fn();
jest.mock('./api', () => ({
  useMarkDeclinesSeen: () => ({ mutate: mockSeen }),
  useWithdrawRequest: () => ({ mutate: mockWithdraw, isPending: false }),
  useLookupSpace: () => ({ mutateAsync: mockLookup, isPending: false }),
  useAskToJoin: () => ({ mutateAsync: mockAsk, isPending: false }),
  useMakeSpace: () => ({ mutateAsync: mockMake, isPending: false }),
  useDeleteAccount: () => ({ mutate: mockDelete, isPending: false }),
}));

const request = (slug: string, outcome: MyJoinRequest['outcome']): MyJoinRequest => ({
  slug,
  name: `${slug} Space`,
  short_name: slug,
  palette: 'teal',
  logo_mark_url: null,
  requested_at: new Date().toISOString(),
  outcome,
});
const chooseOrganization = jest.fn(async () => undefined);
const signOut = jest.fn(async () => undefined);
function as(over: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({ joinRequests: [], account: { age_band: 'adult' }, chooseOrganization, signOut, ...over });
}
const FOUND = { name: 'Ferreira Family Practice', short_name: 'Ferreira', palette: 'teal', logo_mark_url: null, standing: null };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SpaceWelcome (Phase 52)', () => {
  it('shows a decline once, and tells the server only once across re-renders', async () => {
    as({ joinRequests: [request('riverside', 'declined')] });
    function Harness() {
      const [, bump] = useState(0);
      return (
        <>
          <Pressable testID="bump" onPress={() => bump((n) => n + 1)} />
          <SpaceWelcome firstTime />
        </>
      );
    }
    await renderWithProviders(<Harness />);
    expect(screen.getByTestId('welcome-declined-riverside')).toHaveTextContent('riverside Space didn’t accept your request to join.');
    await fireEvent.press(screen.getByTestId('bump'));
    await fireEvent.press(screen.getByTestId('bump'));
    expect(mockSeen).toHaveBeenCalledTimes(1);
  });

  it('lists a request waiting, and withdraws it', async () => {
    as({ joinRequests: [request('assess', null)] });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.getByTestId('welcome-request-assess')).toBeTruthy();
    expect(mockSeen).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('welcome-withdraw-assess'));
    expect(mockWithdraw).toHaveBeenCalledWith('assess', expect.anything());
    mockWithdraw.mock.calls[0][1].onSuccess();
    expect(mockToast.success).toHaveBeenCalledWith('Request to assess Space withdrawn.');
  });

  it('finds a space by its code and asks to join it', async () => {
    as();
    mockLookup.mockResolvedValue({ data: FOUND });
    mockAsk.mockResolvedValue({ data: { requested: true, slug: 'assess' } });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.getByTestId('welcome-find')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('welcome-code'), 'fmxy2345');
    await fireEvent.press(screen.getByTestId('welcome-find'));
    expect(mockLookup).toHaveBeenCalledWith('fmxy2345');
    expect(await screen.findByTestId('welcome-found-name')).toHaveTextContent('Ferreira Family Practice');
    await fireEvent.press(screen.getByTestId('welcome-ask'));
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Asked to join Ferreira Family Practice. Its administrators will let you in.'),
    );
    expect(screen.queryByTestId('welcome-found')).toBeNull();
  });

  it('says the server’s sentence for no such code, and the standing of a known one', async () => {
    as();
    mockLookup.mockRejectedValueOnce(new ApiRequestError(404, 'not_found', 'No space has that code.'));
    await renderWithProviders(<SpaceWelcome firstTime />);
    await fireEvent.changeText(screen.getByTestId('welcome-code'), 'CHMX-2345');
    await fireEvent.press(screen.getByTestId('welcome-find'));
    expect(await screen.findByTestId('welcome-code-error')).toHaveTextContent('No space has that code.');
    mockLookup.mockResolvedValueOnce({ data: { ...FOUND, standing: 'requested' } });
    await fireEvent.press(screen.getByTestId('welcome-find'));
    expect(await screen.findByTestId('welcome-found-standing')).toHaveTextContent('You have asked already.');
    expect(screen.queryByTestId('welcome-ask')).toBeNull();
  });

  it('offers a 13-17 no space of their own', async () => {
    as({ account: { age_band: '13-17' } });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.queryByTestId('welcome-make')).toBeNull();
    expect(screen.getByTestId('welcome-make-adults')).toBeTruthy();
  });

  it('refuses a reserved word before sending; makes a space on the device’s clock and enters it', async () => {
    as();
    mockMake.mockResolvedValue({ data: { slug: 's-abcd2345', name: 'The Creator family' } });
    await renderWithProviders(<SpaceWelcome firstTime />);
    await fireEvent.changeText(screen.getByTestId('welcome-space-name'), 'Aimtrue official');
    await fireEvent.press(screen.getByTestId('welcome-make-submit'));
    expect(screen.getByTestId('welcome-make-error')).toHaveTextContent('A space’s name cannot use the word “aimtrue”.');
    expect(mockMake).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('welcome-space-name'), 'The Creator family');
    await fireEvent.press(screen.getByTestId('welcome-make-submit'));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard'));
    expect(mockMake).toHaveBeenCalledWith({ name: 'The Creator family', time_zone: 'America/New_York' });
    expect(chooseOrganization).toHaveBeenCalledWith('s-abcd2345');
    expect(mockToast.success).toHaveBeenCalledWith('The Creator family is ready.');
  });

  it('has no Delete my account from the picker or the account sheet', async () => {
    as();
    await renderWithProviders(<SpaceWelcome firstTime={false} />);
    expect(screen.queryByTestId('welcome-delete-account')).toBeNull();
  });

  it('deletes the account the first time, behind a confirm', async () => {
    as();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderWithProviders(<SpaceWelcome firstTime />);
    await fireEvent.press(screen.getByTestId('welcome-delete-account'));
    expect(mockDelete).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.text === 'Delete')!.onPress!());
    expect(mockDelete).toHaveBeenCalled();
    mockDelete.mock.calls[0][1].onSuccess();
    expect(signOut).toHaveBeenCalled();
    alert.mockRestore();
  });
});
