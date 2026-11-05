// Phase 72 (UI audit JF4, JF26; owner 2026-11-04): the one "Have a code?" sheet. Signed in it says what a code found
// before sending anything -- a space's NAME first, then the role asked for and a note, then "Ask to join" (a toast
// that names the space) -- and gives a game's code to the game's own join sheet; the server's words when a code
// opens nothing. A code to start from (a kept one, the Quest board's) is looked up at once and, used, forgotten.
// Signed out it only keeps the code on this phone: nothing is sent.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { guestMemory, resetGuestMemoryForTests } from '@/features/guest/guest-store';
import { ApiRequestError } from '@/lib/api-client';
import { renderWithProviders } from '@/test/render';
import { CodeSheet, GuestCodeSheet } from './code-sheet';

const mockRouter = { back: jest.fn(), push: jest.fn(), canGoBack: () => true };
jest.mock('expo-router', () => ({
  get router() {
    return mockRouter;
  },
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useDirty: () => false,
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));
const mockAuth = { current: { account: { age_band: 'adult' } } as Record<string, unknown> };
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth.current }));

const mockLookup = jest.fn();
const mockAsk = jest.fn();
jest.mock('./api', () => ({
  useLookupSpace: () => ({ mutateAsync: mockLookup, isPending: false }),
  useAskToJoin: () => ({ mutateAsync: mockAsk, isPending: false }),
}));
// The game's own join sheet has its tests (game-join-choices, join-game-sheet's flows); here it is a marker.
jest.mock('@/features/quest/join-game-sheet', () => ({
  JoinGameSheet: ({ code }: { code: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="screen-quest-join-game">{code}</Text>;
  },
}));

const FOUND = {
  name: 'Ferreira Family Practice',
  short_name: 'Ferreira',
  palette: 'teal',
  logo_mark_url: null,
  standing: null,
  offers_tutoring: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.current = { account: { age_band: 'adult' } };
  resetGuestMemoryForTests({});
});

describe('CodeSheet (signed in)', () => {
  it('shows the space’s name first, then the role and a note, then asks -- and the toast names the space', async () => {
    mockLookup.mockResolvedValue({ data: FOUND });
    mockAsk.mockResolvedValue({ data: { requested: true, slug: 'assess' } });
    await renderWithProviders(<CodeSheet />);
    expect(screen.getByTestId('code-sheet-go')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('code-sheet-code'), 'fmxy-2345');
    await fireEvent.press(screen.getByTestId('code-sheet-go'));
    expect(mockLookup).toHaveBeenCalledWith('FMXY2345');
    expect(await screen.findByTestId('code-sheet-space')).toHaveTextContent('Ferreira Family Practice');
    expect(screen.getByText('Ask to join, and its admins let you in.')).toBeTruthy();
    // Nothing is sent before Ask to join.
    expect(mockAsk).not.toHaveBeenCalled();
    expect(screen.getByText('You are joining Ferreira Family Practice as')).toBeTruthy();
    expect(screen.getByTestId('join-ask-role-parent').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByTestId('join-ask-role-tutor')).toBeNull();
    await fireEvent.press(screen.getByTestId('join-ask-role-admin'));
    await fireEvent.changeText(screen.getByTestId('join-ask-note'), 'I run the Tuesday group.');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('code-sheet-ask'));
    });
    expect(mockAsk).toHaveBeenCalledWith({ code: 'FMXY2345', role: 'admin', note: 'I run the Tuesday group.' });
    expect(mockToast.success).toHaveBeenCalledWith('Asked to join Ferreira Family Practice. Its admins will let you in.');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('offers a tutor where the space has Tutoring, and a 13-17 only a learner (no choice to make)', async () => {
    mockLookup.mockResolvedValue({ data: { ...FOUND, offers_tutoring: true } });
    await renderWithProviders(<CodeSheet initialCode="FMXY2345" />);
    expect(await screen.findByTestId('join-ask-role-tutor')).toBeTruthy();
    await screen.unmount();

    mockAuth.current = { account: { age_band: '13-17' } };
    mockAsk.mockResolvedValue({ data: { requested: true, slug: 'assess' } });
    await renderWithProviders(<CodeSheet initialCode="FMXY2345" />);
    await screen.findByTestId('code-sheet-space');
    expect(screen.queryByTestId('join-ask-role-student')).toBeNull();
    expect(screen.getByTestId('join-ask-note')).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByTestId('code-sheet-ask'));
    });
    expect(mockAsk).toHaveBeenCalledWith({ code: 'FMXY2345', role: 'student', note: null });
  });

  it('says the server’s words when a code opens nothing, and a refusal to ask', async () => {
    mockLookup.mockRejectedValueOnce(new ApiRequestError(404, 'not_found', 'No space has that code.'));
    await renderWithProviders(<CodeSheet />);
    await fireEvent.changeText(screen.getByTestId('code-sheet-code'), 'ZZZZ9999');
    await fireEvent.press(screen.getByTestId('code-sheet-go'));
    expect(await screen.findByTestId('code-sheet-error')).toHaveTextContent('No space has that code.');

    mockLookup.mockResolvedValueOnce({ data: FOUND });
    mockAsk.mockRejectedValueOnce(new ApiRequestError(429, 'rate_limited', 'You have too many requests waiting.'));
    await fireEvent.changeText(screen.getByTestId('code-sheet-code'), 'FMXY2345');
    await fireEvent.press(screen.getByTestId('code-sheet-go'));
    await screen.findByTestId('code-sheet-space');
    await act(async () => {
      await fireEvent.press(screen.getByTestId('code-sheet-ask'));
    });
    expect(screen.getByTestId('code-sheet-error')).toHaveTextContent('You have too many requests waiting.');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('a space they belong to, or asked already: said, with no Ask; Another code goes back to the box', async () => {
    mockLookup.mockResolvedValue({ data: { ...FOUND, standing: 'member' } });
    await renderWithProviders(<CodeSheet initialCode="FMXY2345" />);
    expect(await screen.findByText('You already belong to Ferreira Family Practice.')).toBeTruthy();
    expect(screen.queryByTestId('code-sheet-ask')).toBeNull();
    expect(screen.queryByTestId('join-ask')).toBeNull();
    await fireEvent.press(screen.getByTestId('code-sheet-another'));
    expect(screen.getByTestId('code-sheet-code').props.value).toBe('');
  });

  it('gives a game’s code to the game’s own join sheet, which looks it up', async () => {
    await renderWithProviders(<CodeSheet />);
    await fireEvent.changeText(screen.getByTestId('code-sheet-code'), 'abc-234');
    await fireEvent.press(screen.getByTestId('code-sheet-go'));
    expect(screen.getByTestId('screen-quest-join-game')).toHaveTextContent('ABC234');
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it('looks a code to start from up at once, and forgets a kept one once used', async () => {
    guestMemory.keepCode('FMXY2345');
    mockLookup.mockResolvedValue({ data: FOUND });
    await renderWithProviders(<CodeSheet initialCode="fmxy-2345" />);
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('FMXY2345'));
    await screen.findByTestId('code-sheet-space');
    expect(guestMemory.keptCode()).toBeUndefined();
    await screen.unmount();

    guestMemory.keepCode('ABC234');
    await renderWithProviders(<CodeSheet initialCode="ABC234" />);
    expect(screen.getByTestId('screen-quest-join-game')).toHaveTextContent('ABC234');
    expect(guestMemory.keptCode()).toBeUndefined();
  });
});

describe('GuestCodeSheet (signed out)', () => {
  it('keeps the code on this phone and sends nothing; then offers sign-up or Keep playing', async () => {
    const onClose = jest.fn();
    const onSignUp = jest.fn();
    await renderWithProviders(<GuestCodeSheet visible onClose={onClose} onSignUp={onSignUp} />);
    expect(screen.getByTestId('code-sheet-go')).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId('code-sheet-code'), 'fmxy 2345');
    await fireEvent.press(screen.getByTestId('code-sheet-go'));
    expect(screen.getByTestId('code-sheet-kept')).toHaveTextContent(
      'FMXY2345 will be waiting on your first screen once you have signed up or signed in. Nothing is sent until you use it.',
    );
    expect(guestMemory.keptCode()).toBe('FMXY2345');
    expect(mockLookup).not.toHaveBeenCalled();
    expect(mockAsk).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('code-sheet-sign-up'));
    expect(onClose).toHaveBeenCalled();
    expect(onSignUp).toHaveBeenCalled();
  });
});
