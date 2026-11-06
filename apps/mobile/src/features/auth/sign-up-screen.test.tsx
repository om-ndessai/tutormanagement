import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking, ScrollView } from 'react-native';

import { addressKey, guestMemory, resetGuestMemoryForTests } from '@/features/guest/guest-store';
import { ApiRequestError } from '@/lib/api-client';
import { STORAGE_KEYS } from '@/lib/storage';
import { renderWithProviders } from '@/test/render';
import { birthYearStart } from './sign-up-model';
import { SignUpScreen, TOO_YOUNG_BODY, TOO_YOUNG_BODY_NO_PLAY } from './sign-up-screen';

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockDismissTo = jest.fn();
jest.mock('expo-router', () => ({ router: { dismissTo: (to: unknown) => mockDismissTo(to) } }));

const completeSignup = jest.fn();
const cancelSignup = jest.fn(async () => undefined);
/** `guest`: whether the server offers guest play (the Play home to go back to). */
function as(pending: Record<string, unknown>, { guest = false } = {}) {
  mockAuth.mockReturnValue({
    pendingSignup: pending,
    completeSignup,
    cancelSignup,
    config: { signup_open: true, guest: guest ? { version: 'v1', tiles: [] } : null },
  });
}
const GOOGLE = { token: 't', email: 'nina@example.com', name: 'Nina Newcomer', dev: false };
const DEV = { token: null, email: 'sam.signup@example.com', name: 'sam.signup@example.com', dev: true };

async function fill() {
  await fireEvent.press(screen.getByTestId('signup-month'));
  await fireEvent.press(screen.getByTestId('signup-month-6'));
  await fireEvent.press(screen.getByTestId('signup-year'));
  await fireEvent.changeText(screen.getByTestId('signup-year-search'), '1990');
  await fireEvent.press(screen.getByTestId('signup-year-1990'));
}

beforeEach(() => {
  completeSignup.mockReset();
  cancelSignup.mockClear();
  mockDismissTo.mockClear();
  resetGuestMemoryForTests({});
});

describe('SignUpScreen (Phase 52)', () => {
  it('greets the person, and holds Continue until the month, the year and the tick', async () => {
    as(GOOGLE);
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByText('Welcome, Nina')).toBeTruthy();
    expect(screen.queryByTestId('signup-dev-name')).toBeNull();
    expect(screen.getByTestId('signup-submit')).toBeDisabled();
    await fill();
    expect(screen.getByTestId('signup-submit')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    expect(screen.getByTestId('signup-submit')).toBeEnabled();
    completeSignup.mockResolvedValue(undefined);
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(completeSignup).toHaveBeenCalledWith({ birth_year: 1990, birth_month: 6 });
  });

  it('says only the age group is kept, and shows all twelve months at once, with no search', async () => {
    as(GOOGLE);
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByText('We keep only your age group, never the date.')).toBeTruthy();
    expect(screen.queryByText(/over 18/)).toBeNull();
    await fireEvent.press(screen.getByTestId('signup-month'));
    for (let month = 1; month <= 12; month += 1)
      expect(screen.getByTestId(`signup-month-${month}`)).toBeTruthy();
    expect(screen.getByLabelText('October')).toBeTruthy();
    expect(screen.queryByTestId('signup-month-search')).toBeNull();
    await fireEvent.press(screen.getByTestId('signup-month-10'));
    expect(screen.getByTestId('signup-month')).toHaveTextContent(/October/);
    // The year keeps its search.
    await fireEvent.press(screen.getByTestId('signup-year'));
    expect(screen.getByTestId('signup-year-search')).toBeTruthy();
  });

  // Phase 78 (UI audit JF35): the year list opens near an adult's year, not at this year; every year stays a scroll
  // (or a typed year) away, a child's too.
  it('opens the year list near an adult’s year, with every year in it', async () => {
    as(GOOGLE);
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.press(screen.getByTestId('signup-year'));
    const start = String(birthYearStart(new Date()));
    const thisYear = String(new Date().getFullYear());
    expect(screen.getByTestId(`signup-year-${thisYear}`)).toBeTruthy();
    expect(screen.getByTestId(`signup-year-${Number(thisYear) - 99}`)).toBeTruthy();
    expect(screen.queryByText(/Showing 8 of/)).toBeNull();
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => undefined);
    const row = screen.getByTestId(`signup-year-${start}`).parent;
    // The row's wrapper reports where it sits: the list scrolls there, once.
    let wrapper = row;
    while (wrapper && !wrapper.props.onLayout) wrapper = wrapper.parent;
    await fireEvent(wrapper!, 'layout', { nativeEvent: { layout: { x: 0, y: 1488, width: 300, height: 48 } } });
    await fireEvent(wrapper!, 'layout', { nativeEvent: { layout: { x: 0, y: 9, width: 300, height: 48 } } });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 1488, animated: false });
    scrollTo.mockRestore();
  });

  it('under 13, with guest play: asks a grown-up, Keep playing goes back to the Play home and clears the sign-up', async () => {
    as(GOOGLE, { guest: true });
    completeSignup.mockRejectedValue(new ApiRequestError(400, 'too_young', 'You need to be 13 or older.'));
    await renderWithProviders(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('signup-too-young')).toBeTruthy();
    expect(screen.getByTestId('signup-too-young-title')).toHaveTextContent('Ask a grown-up to add you');
    expect(screen.getByTestId('signup-too-young-body')).toHaveTextContent(TOO_YOUNG_BODY);
    expect(screen.queryByTestId('signup-too-young-back')).toBeNull();
    await fireEvent.press(screen.getByTestId('signup-too-young-keep-playing'));
    expect(mockDismissTo).toHaveBeenCalledWith('/play');
    await waitFor(() => expect(cancelSignup).toHaveBeenCalled());
  });

  it('under 13, in the sign-up sheet: Keep playing closes the sheet (back to the question left)', async () => {
    as(GOOGLE, { guest: true });
    completeSignup.mockRejectedValue(new ApiRequestError(400, 'too_young', 'You need to be 13 or older.'));
    const close = jest.fn();
    await renderWithProviders(<SignUpScreen onKeepPlaying={close} />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    await fireEvent.press(await screen.findByTestId('signup-too-young-keep-playing'));
    expect(close).toHaveBeenCalled();
    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it('under 13, without guest play: no promise of play, and Back to sign-in clears the sign-up', async () => {
    as(GOOGLE);
    completeSignup.mockRejectedValue(new ApiRequestError(400, 'too_young', 'You need to be 13 or older.'));
    await renderWithProviders(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(await screen.findByTestId('signup-too-young')).toBeTruthy();
    expect(screen.getByTestId('signup-too-young-body')).toHaveTextContent(TOO_YOUNG_BODY_NO_PLAY);
    expect(screen.queryByTestId('signup-too-young-keep-playing')).toBeNull();
    await fireEvent.press(screen.getByTestId('signup-too-young-back'));
    expect(cancelSignup).toHaveBeenCalled();
  });

  it('remembers an under-13 refusal on this phone by a key of the address, never the address', async () => {
    as(GOOGLE, { guest: true });
    completeSignup.mockRejectedValue(new ApiRequestError(400, 'too_young', 'You need to be 13 or older.'));
    await renderWithProviders(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    await screen.findByTestId('signup-too-young');
    expect(guestMemory.refusedYoung('nina@example.com')).toBe(true);
    expect(guestMemory.refusedYoung('NINA@example.com ')).toBe(true);
    expect(guestMemory.refusedYoung('parent@example.com')).toBe(false);
  });

  it('a remembered account goes straight to "Ask a grown-up", without the age question', async () => {
    resetGuestMemoryForTests({ tooYoung: [addressKey('nina@example.com')] });
    as(GOOGLE, { guest: true });
    await renderWithProviders(<SignUpScreen />);
    expect(screen.getByTestId('signup-too-young')).toBeTruthy();
    expect(screen.queryByTestId('signup-month')).toBeNull();
    expect(screen.queryByTestId('signup-submit')).toBeNull();
    expect(completeSignup).not.toHaveBeenCalled();
  });

  it('another account on the same phone (a parent’s) is asked its age as usual', async () => {
    resetGuestMemoryForTests({ tooYoung: [addressKey('nina@example.com')] });
    as({ ...GOOGLE, email: 'parent@example.com', name: 'Pat Parent' });
    await renderWithProviders(<SignUpScreen />);
    expect(screen.queryByTestId('signup-too-young')).toBeNull();
    expect(screen.getByTestId('signup-month')).toBeTruthy();
  });

  it('reads the phone’s memory first when it has not been read yet this run', async () => {
    await AsyncStorage.clear();
    resetGuestMemoryForTests();
    as(GOOGLE);
    await renderWithProviders(<SignUpScreen />);
    expect(await screen.findByTestId('signup-month')).toBeTruthy();
  });

  it('a refusal remembered in an earlier run (the phone’s storage) still goes straight to the answer', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.guest,
      JSON.stringify({ tooYoung: [addressKey('nina@example.com')] }),
    );
    resetGuestMemoryForTests();
    as(GOOGLE, { guest: true });
    await renderWithProviders(<SignUpScreen />);
    expect(await screen.findByTestId('signup-too-young')).toBeTruthy();
    expect(screen.queryByTestId('signup-month')).toBeNull();
    await AsyncStorage.clear();
  });

  it('shows any other refusal in the server’s words', async () => {
    as(GOOGLE);
    completeSignup.mockRejectedValue(new ApiRequestError(409, 'conflict', 'That address already has an account.'));
    await renderWithProviders(<SignUpScreen />);
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    await waitFor(() => expect(screen.getByTestId('signup-error')).toHaveTextContent('That address already has an account.'));
  });

  it('opens the terms and the privacy notice on the portal’s address', async () => {
    as(GOOGLE);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.press(screen.getByTestId('signup-terms'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/\/terms$/));
    await fireEvent.press(screen.getByTestId('signup-privacy'));
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/\/privacy$/));
    open.mockRestore();
  });

  it('asks a developer sign-up for a name, and sends it', async () => {
    as(DEV);
    completeSignup.mockResolvedValue(undefined);
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByTestId('signup-dev-name'), 'Sam Signup');
    expect(screen.getByText('Welcome, Sam')).toBeTruthy();
    await fill();
    await fireEvent.press(screen.getByTestId('signup-accept'));
    await fireEvent.press(screen.getByTestId('signup-submit'));
    expect(completeSignup).toHaveBeenCalledWith({ birth_year: 1990, birth_month: 6, dev_name: 'Sam Signup' });
  });
});
