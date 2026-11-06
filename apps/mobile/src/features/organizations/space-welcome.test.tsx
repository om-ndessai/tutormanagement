import type { MyJoinRequest } from '@tmi/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { clearInviteStep, hasInviteStep } from './invite-step';
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
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => mockAuth(),
  useOrgTimeZone: () => 'America/New_York',
}));

const mockDismiss = jest.fn(async () => ({ data: { dismissed: true } }));
const mockWithdraw = jest.fn();
const mockLookup = jest.fn();
const mockAsk = jest.fn();
const mockMake = jest.fn();
const mockDelete = jest.fn();
jest.mock('./api', () => ({
  useDismissJoinOutcome: () => ({ mutateAsync: mockDismiss, isPending: false }),
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
  answered_at: outcome ? '2026-11-03T15:00:00Z' : null,
});
const chooseOrganization = jest.fn(async () => undefined);
const signOut = jest.fn(async () => undefined);
function as(over: Record<string, unknown> = {}) {
  mockAuth.mockReturnValue({
    joinRequests: [],
    memberships: [],
    invitations: [],
    account: { age_band: 'adult' },
    chooseOrganization,
    signOut,
    ...over,
  });
}
const FOUND = { name: 'Ferreira Family Practice', short_name: 'Ferreira', palette: 'teal', logo_mark_url: null, standing: null };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SpaceWelcome (Phase 52)', () => {
  it('keeps a decline, with its day, until it is dismissed -- and viewing it marks nothing (JF5)', async () => {
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
    const row = screen.getByTestId('welcome-declined-riverside');
    expect(row).toHaveTextContent(/riverside Space did not let you in/);
    expect(row).toHaveTextContent(/Declined on Nov 3, 2026\./);
    await fireEvent.press(screen.getByTestId('bump'));
    await fireEvent.press(screen.getByTestId('bump'));
    expect(screen.getByTestId('welcome-declined-riverside')).toBeTruthy();
    expect(mockDismiss).not.toHaveBeenCalled();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('welcome-dismiss-riverside'));
    });
    expect(mockDismiss).toHaveBeenCalledWith('riverside');
  });

  it('a let in: "You\'re in", Open enters the space', async () => {
    as({ joinRequests: [request('assess', 'approved')] });
    await renderWithProviders(<SpaceWelcome firstTime={false} />);
    expect(screen.getByTestId('welcome-approved-assess')).toHaveTextContent(/You're in assess Space\./);
    expect(screen.queryByTestId('welcome-ask-again-assess')).toBeNull();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('welcome-open-assess'));
    });
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(chooseOrganization).toHaveBeenCalledWith('assess');
    expect(mockRouter.replace).toHaveBeenCalledWith('/dashboard');
  });

  it('Ask again goes to the code field', async () => {
    as({ joinRequests: [request('riverside', 'declined')] });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.getByTestId('welcome-ask-again-riverside')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('welcome-ask-again-riverside'));
    expect(screen.getByTestId('welcome-code')).toBeTruthy();
  });

  it('lists a request waiting, and withdraws it', async () => {
    as({ joinRequests: [request('assess', null)] });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.getByTestId('welcome-request-assess')).toBeTruthy();
    expect(mockDismiss).not.toHaveBeenCalled();
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
    // Phase 72 (JF26): the role asked for (a parent by default) and a note, before Ask to join.
    expect(screen.getByText('You are joining Ferreira Family Practice as')).toBeTruthy();
    expect(screen.getByTestId('join-ask-role-parent').props.accessibilityState).toMatchObject({ checked: true });
    // No Tutoring there: nobody asks to be its tutor.
    expect(screen.queryByTestId('join-ask-role-tutor')).toBeNull();
    await fireEvent.press(screen.getByTestId('welcome-ask'));
    await waitFor(() =>
      expect(mockToast.success).toHaveBeenCalledWith('Asked to join Ferreira Family Practice. Its admins will let you in.'),
    );
    expect(mockAsk).toHaveBeenCalledWith({ code: 'fmxy2345', role: 'parent', note: null });
    expect(screen.queryByTestId('welcome-found')).toBeNull();
  });

  it('asks with the role chosen and a note (Phase 72, JF26)', async () => {
    as();
    mockLookup.mockResolvedValue({ data: { ...FOUND, offers_tutoring: true } });
    mockAsk.mockResolvedValue({ data: { requested: true, slug: 'assess' } });
    await renderWithProviders(<SpaceWelcome firstTime />);
    await fireEvent.changeText(screen.getByTestId('welcome-code'), 'FMXY-2345');
    await fireEvent.press(screen.getByTestId('welcome-find'));
    await screen.findByTestId('welcome-found-name');
    await fireEvent.press(screen.getByTestId('join-ask-role-tutor'));
    await fireEvent.changeText(screen.getByTestId('join-ask-note'), '  I teach Grade 4 on Tuesdays.  ');
    await fireEvent.press(screen.getByTestId('welcome-ask'));
    await waitFor(() =>
      expect(mockAsk).toHaveBeenCalledWith({ code: 'FMXY-2345', role: 'tutor', note: 'I teach Grade 4 on Tuesdays.' }),
    );
  });

  it('asks a 13-17 nothing about a role: a learner (Phase 72)', async () => {
    as({ account: { age_band: '13-17' } });
    mockLookup.mockResolvedValue({ data: FOUND });
    mockAsk.mockResolvedValue({ data: { requested: true, slug: 'assess' } });
    await renderWithProviders(<SpaceWelcome firstTime />);
    await fireEvent.changeText(screen.getByTestId('welcome-code'), 'fmxy2345');
    await fireEvent.press(screen.getByTestId('welcome-find'));
    await screen.findByTestId('welcome-found-name');
    expect(screen.queryByTestId('join-ask-role-parent')).toBeNull();
    expect(screen.getByTestId('join-ask-note')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('welcome-ask'));
    await waitFor(() => expect(mockAsk).toHaveBeenCalledWith({ code: 'fmxy2345', role: 'student', note: null }));
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

  it('offers a 13-17 no space of their own, and the way forward instead (UI audit JF7)', async () => {
    as({ account: { age_band: '13-17' } });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.queryByTestId('welcome-make')).toBeNull();
    const card = screen.getByTestId('welcome-adults-only');
    expect(card).toHaveTextContent(/A club needs an adult to start its space/);
    expect(card).toHaveTextContent(/Ask a teacher or a parent to start it, then join it with its code here\./);
    expect(screen.queryByText(/18 or older/)).toBeNull();
    expect(screen.getByTestId('welcome-join')).toBeTruthy();
  });

  it('offers a student a space added, with no age given, no space of their own -- nor anyone in no space -- and tells neither about ages (S11, JF7)', async () => {
    as({ account: null, memberships: [{ slug: 'chmi', name: 'Chapel Hill Math Institute', roles: ['student'], status: 'active' }] });
    await renderWithProviders(<SpaceWelcome firstTime={false} />);
    expect(screen.queryByTestId('welcome-make')).toBeNull();
    expect(screen.queryByTestId('welcome-adults-only')).toBeNull();
    expect(screen.getByTestId('welcome-join')).toBeTruthy();
    await screen.unmount();
    as({ account: null, memberships: [] });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.queryByTestId('welcome-make')).toBeNull();
    expect(screen.queryByTestId('welcome-adults-only')).toBeNull();
  });

  it('opens on the new space’s name from Start a space (JF7)', async () => {
    as();
    await renderWithProviders(<SpaceWelcome firstTime={false} focusStart />);
    expect(screen.getByTestId('welcome-space-name').props.autoFocus).toBe(true);
    expect(screen.getByTestId('welcome-code').props.autoFocus).toBe(false);
  });

  it('offers a parent a space added the form (their role vouches)', async () => {
    as({ account: null, memberships: [{ slug: 'chmi', name: 'Chapel Hill Math Institute', roles: ['parent'], status: 'active' }] });
    await renderWithProviders(<SpaceWelcome firstTime={false} />);
    expect(screen.getByTestId('welcome-make')).toBeTruthy();
    expect(screen.queryByTestId('welcome-adults-only')).toBeNull();
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
    // Phase 61 (S12): the new space opens on "Invite people".
    expect(hasInviteStep('s-abcd2345')).toBe(true);
    clearInviteStep();
  });

  it('offers an adult the two choices, in the Phase 61 words (S11)', async () => {
    as();
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.getByTestId('welcome-choices')).toBeTruthy();
    expect(screen.getByText('Join with a code')).toBeTruthy();
    expect(screen.getByText('Start a space')).toBeTruthy();
    expect(screen.getByTestId('welcome-make-submit')).toHaveTextContent('Start the space');
    expect(screen.getByText(/and Quest\..*invite people next\./s)).toBeTruthy();
    expect(screen.queryByTestId('welcome-adults-only')).toBeNull();
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

  it('has no Delete my account for a platform admin in no space (the API refuses one)', async () => {
    as({ platformAdmin: true });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.getByTestId('welcome-choices')).toBeTruthy();
    expect(screen.queryByTestId('welcome-delete-account')).toBeNull();
  });

  it('keeps Delete my account away while anything is open: a request sent or an invitation (Phase 60)', async () => {
    as({ joinRequests: [request('assess', null)] });
    await renderWithProviders(<SpaceWelcome firstTime />);
    // Phase 78 (JF35): a heading in sentence case, as on the web.
    expect(screen.getByText('Requests sent')).toBeTruthy();
    expect(screen.queryByText('REQUESTS SENT')).toBeNull();
    expect(screen.queryByTestId('welcome-delete-account')).toBeNull();
    await screen.unmount();
    as({ invitations: [{ slug: 'chmi' }] });
    await renderWithProviders(<SpaceWelcome firstTime />);
    expect(screen.queryByTestId('welcome-delete-account')).toBeNull();
  });
});
