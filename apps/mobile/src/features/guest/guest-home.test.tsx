// Phase 63 (P10, P12), redesigned as the Quest board (2026-11-02, direction C): the band (the home bar,
// Sign in), Today's 5 and its done state, the grade row (remembered on the phone), the grade's cards with
// masked words (never a code or a curriculum), the locked ones the offer, the advanced ones, the grown-ups'
// panels, the answers and the footer, and a signed-in person sent on to their space.
import { fireEvent, screen } from '@testing-library/react-native';
import type { GuestConfig, GuestTile } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { GuestHome } from './guest-home';
import { guestDay } from '@tmi/shared';
import { Linking } from 'react-native';

import { declinedThisRun, guestMemory, resetGuestMemoryForTests } from './guest-store';

const mockPost = jest.fn(async (_path: string, _body?: unknown) => undefined);
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: jest.fn(), post: (path: string, body?: unknown) => mockPost(path, body) },
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (to: unknown) => mockPush(to), replace: (to: unknown) => mockReplace(to) },
  useIsFocused: () => true,
}));
jest.mock('@/features/auth/legal-links', () => ({ openLegal: (kind: string) => mockLegal(kind) }));
const mockLegal = jest.fn();

const tile = (code: string, level: GuestTile['level_id'], locked: boolean, words: string): GuestTile => ({
  code,
  kind: 'quest',
  level_id: level,
  mode: 'count',
  value: 5,
  words,
  locked,
});
const mockGuest: GuestConfig = {
  version: 'v1',
  settings: {
    assessment_enabled: false,
    assessment_questions: 5,
    nudge_after: 1,
    nudge_cooldown_hours: 24,
    nudge_right: 'Nice!',
    nudge_wrong: 'Good try.',
    home_bar: 'Save your scores and unlock every quest.',
  },
  tiles: [
    tile('G3Q5', 'NC26.3', false, 'Grade 3 · 5 questions'),
    tile('G4Q5', 'NC26.4', false, 'Grade 4 · 5 questions'),
    { ...tile('G4T10', 'NC26.4', true, 'Grade 4 · 10 minutes'), mode: 'timed', value: 10 },
    tile('BA4Q5', 'BA4', false, 'Adv G4 · 5 questions'),
  ],
  member_counts: { 'NC26.4': 1234 },
};

let mockStatus = 'unauthenticated';
let mockSignupOpen = true;
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ status: mockStatus, config: { signup_open: mockSignupOpen, guest: mockGuest } }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockStatus = 'unauthenticated';
  mockSignupOpen = true;
  resetGuestMemoryForTests({});
});

describe('GuestHome, the Quest board', () => {
  it('opens on Grade 4: the band, Today’s 5, its cards with masked words, the locked one the offer', async () => {
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-home-bar')).toHaveTextContent('Save your scores and unlock every quest.');
    expect(screen.getByTestId('guest-band-signup')).toHaveTextContent('Sign up free');
    expect(screen.getByText('Hit the target.')).toBeTruthy();
    for (const promise of ['Free play', 'Grades 1–8', 'No account to start', 'No ads']) expect(screen.getByText(promise)).toBeTruthy();
    expect(screen.getByTestId('guest-today')).toHaveTextContent(/Today’s 5 · Grade 4/);
    expect(screen.getByText('Five questions. Can you hit all five?')).toBeTruthy();
    expect(screen.getByTestId('guest-tile-G4Q5')).toHaveTextContent(/Quick 5/);
    expect(screen.getByTestId('guest-tile-G4Q5')).toHaveTextContent(/5 questions/);
    expect(screen.getByTestId('guest-locked-G4T10')).toHaveTextContent(/10-minute challenge.*Free account/);
    expect(screen.getByText('Advanced')).toBeTruthy();
    expect(screen.getByTestId('guest-tile-BA4Q5')).toHaveTextContent(/Adv G4 · 5 questions/);
    expect(screen.queryByTestId('guest-tile-G3Q5')).toBeNull();
    // Never a code or a curriculum's name on the board.
    expect(screen.queryByText(/G4Q5|BA4|Beast/)).toBeNull();
    await fireEvent.press(screen.getByTestId('guest-locked-G4T10'));
    expect(screen.getByText('10-minute challenge is free with an account')).toBeTruthy();
    expect(screen.getByText('1,200+ more Grade 4 questions, never repeated')).toBeTruthy();
    expect(screen.getByTestId('guest-nudge-close')).toHaveTextContent('Not now');
    await fireEvent.press(screen.getByTestId('guest-nudge-signup'));
    expect(mockPush).toHaveBeenCalledWith('/sign-up-sheet');
  });

  it('plays a card in one tap, and remembers the grade on the phone as its level', async () => {
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-grade-4').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByLabelText('Grade 3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guest-grade-3'));
    expect(guestMemory.grade()).toBe('NC26.3');
    await fireEvent.press(screen.getByTestId('guest-tile-G3Q5'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/play/[code]', params: { code: 'G3Q5' } });
    await fireEvent.press(screen.getByTestId('guest-sign-in'));
    expect(mockPush).toHaveBeenCalledWith('/sign-in');
  });

  it('maps an older remembered level to its grade, and says when a grade has nothing yet', async () => {
    resetGuestMemoryForTests({ grade: 'NC17.3' });
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-tile-G3Q5')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('guest-grade-7'));
    expect(screen.getByText('Quests for Grade 7 are on their way.')).toBeTruthy();
    expect(screen.queryByTestId('guest-today')).toBeNull();
  });

  it('plays Today’s 5, and shows the day’s hits once played', async () => {
    await renderWithProviders(<GuestHome />);
    await fireEvent.press(screen.getByTestId('guest-today-play'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/play/today', params: { level: 'NC26.4' } });
  });

  it('shows Today’s 5 as played today on this phone', async () => {
    resetGuestMemoryForTests({ today: { day: guestDay(), level: 'NC26.4', hits: [true, false, true, true, false] } });
    await renderWithProviders(<GuestHome />);
    expect(screen.getByText('You hit 3 of 5 today. A new five tomorrow.')).toBeTruthy();
    expect(screen.getByTestId('guest-today-play')).toHaveTextContent(/Play again/);
    // Yesterday's is not today's.
    resetGuestMemoryForTests({ today: { day: '2020-01-01', level: 'NC26.4', hits: [true] } });
    await renderWithProviders(<GuestHome />);
    expect(screen.getAllByText('Five questions. Can you hit all five?').length).toBeGreaterThan(0);
  });

  it('offers grown-ups a family space (Sign in while sign-up is closed), the answers and the footer', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-parents')).toHaveTextContent(/One code, everyone joins/);
    expect(screen.queryByText(/Place value/)).toBeNull();
    await fireEvent.press(screen.getByTestId('guest-parents-start'));
    expect(mockPush).toHaveBeenCalledWith('/sign-up-sheet');
    expect(screen.queryByTestId('guest-answer-0-text')).toBeNull();
    await fireEvent.press(screen.getByTestId('guest-answer-0'));
    expect(screen.getByTestId('guest-answer-0-text')).toHaveTextContent(/Anyone can play the free quests/);
    await fireEvent.press(screen.getByTestId('guest-privacy'));
    expect(mockLegal).toHaveBeenCalledWith('privacy');
    await fireEvent.press(screen.getByTestId('guest-contact'));
    expect(openURL).toHaveBeenCalledWith('mailto:om.ndessai@gmail.com');
    mockSignupOpen = false;
    mockPush.mockClear();
    await renderWithProviders(<GuestHome />);
    const starts = screen.getAllByTestId('guest-parents-start');
    expect(starts[starts.length - 1]).toHaveTextContent('Sign in');
    await fireEvent.press(starts[starts.length - 1]!);
    expect(mockPush).toHaveBeenCalledWith('/sign-in');
  });

  it('speaks to every visitor: the line under the headline, and Can adults play? among the answers (JF10)', async () => {
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-audience')).toHaveTextContent('For kids, teens, grown-ups and classes.');
    expect(screen.getByTestId('guest-answer-3')).toHaveTextContent(/Can adults play\?/);
    await fireEvent.press(screen.getByTestId('guest-answer-3'));
    expect(screen.getByTestId('guest-answer-3-text')).toHaveTextContent(
      'Yes. Quests go from Grade 1 to Algebra and contest maths, so grown-ups, teens and classes play too. An account is free.',
    );
  });

  it('after a declined sign-up in this run, offers Sign in only, not sign-up (JF8)', async () => {
    declinedThisRun.mark();
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-band-signup')).toHaveTextContent('Sign in');
    expect(screen.queryByText('Sign up free')).toBeNull();
    expect(screen.getByTestId('guest-parents-start')).toHaveTextContent('Sign in');
    await fireEvent.press(screen.getByTestId('guest-band-signup'));
    expect(mockPush).toHaveBeenCalledWith('/sign-in');
    expect(mockPush).not.toHaveBeenCalledWith('/sign-up-sheet');
    // The locked card's offer says Sign in too.
    await fireEvent.press(screen.getByTestId('guest-locked-G4T10'));
    expect(screen.getByTestId('guest-nudge-signup')).toHaveTextContent('Sign in');
    expect(screen.getByTestId('guest-sign-in')).toBeTruthy();
  });

  it('sends someone signed in on to their space', async () => {
    mockStatus = 'authenticated';
    await renderWithProviders(<GuestHome />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
