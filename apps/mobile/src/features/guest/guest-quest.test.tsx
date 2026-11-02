// Phase 63 (P10, P12): a guest's quest on the phone, with the pool served at the network edge -- one
// request for the pool and nothing between answers; the offer after question 1 pauses a timed quest's
// clock and Keep playing runs it again; the offer does not come back in the same quest; the results
// show the score and each question with its key.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { GuestConfig, GuestQuestion, GuestTile } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { forgetGuestPoolsForTests } from './guest-api';
import { GuestQuest } from './guest-quest';
import { guestMemory, resetGuestMemoryForTests } from './guest-store';

const mockGet = jest.fn();
const mockPost = jest.fn(async (_path: string, _body?: unknown) => undefined);
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: {
    get: (path: string) => mockGet(path),
    post: (path: string, body?: unknown) => mockPost(path, body),
  },
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (to: unknown) => mockPush(to),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: () => true,
    canDismiss: () => false,
    dismissAll: jest.fn(),
    dismissTo: jest.fn(),
  },
  useIsFocused: () => true,
}));

const COUNT: GuestTile = { code: 'G4Q5', kind: 'quest', level_id: 'NC26.4', mode: 'count', value: 3, words: 'Grade 4 · 3 questions', locked: false };
const TIMED: GuestTile = { ...COUNT, code: 'G4T10', mode: 'timed', value: 10, words: 'Grade 4 · 10 minutes' };

const mockGuest: GuestConfig = {
  version: 'v1',
  settings: {
    assessment_enabled: false,
    assessment_questions: 5,
    nudge_after: 1,
    nudge_cooldown_hours: 24,
    nudge_right: 'Nice! That one is right.',
    nudge_wrong: 'Good try. Keep going!',
    home_bar: 'Playing as a guest.',
  },
  tiles: [COUNT, TIMED],
  member_counts: { 'NC26.4': 1234 },
};

let mockSignupOpen = true;
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ status: 'unauthenticated', config: { signup_open: mockSignupOpen, guest: mockGuest } }),
}));

const q = (id: string, difficulty: number): GuestQuestion => ({
  id,
  kind: 'numeric',
  stem: `What is ${id}?`,
  choices: [],
  answer: '4',
  solution: 'Count them.',
  difficulty,
  beta: false,
});
const POOL = [q('q1', 1), q('q2', 1), q('q3', 2), q('q4', 3)];

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockClear();
  mockPush.mockClear();
  mockSignupOpen = true;
  forgetGuestPoolsForTests();
  resetGuestMemoryForTests({});
  mockGet.mockResolvedValue({ data: { level_id: 'NC26.4', version: 'v1', questions: POOL } });
});

async function answerNumber(text: string) {
  await fireEvent.changeText(screen.getByTestId('guest-number'), text);
  await fireEvent.press(screen.getByTestId('guest-answer'));
}

describe('GuestQuest (Phase 63)', () => {
  it('plays a count tile on the phone: the offer after question 1, then the results', async () => {
    await renderWithProviders(<GuestQuest tile={COUNT} />);
    await waitFor(() => expect(screen.getByTestId('guest-question')).toBeTruthy());
    expect(mockGet).toHaveBeenCalledWith('/public/guest/v1/NC26.4');
    expect(screen.getByTestId('guest-progress')).toHaveTextContent('1 of 3');

    await answerNumber('4');
    expect(screen.getByTestId('guest-nudge')).toBeTruthy();
    expect(screen.getByText('Nice! That one is right.')).toBeTruthy();
    expect(screen.getByText('1,200+ more Grade 4 questions, never repeated')).toBeTruthy();
    expect(screen.getByTestId('guest-nudge-signup')).toHaveTextContent('Sign up free');
    await fireEvent.press(screen.getByTestId('guest-nudge-close'));
    await waitFor(() => expect(screen.queryByTestId('guest-nudge')).toBeNull());
    expect(guestMemory.nudgeDismissedAt()).toBeDefined();

    await fireEvent.press(screen.getByTestId('guest-skip'));
    // Not again in this quest.
    expect(screen.queryByTestId('guest-nudge')).toBeNull();
    await answerNumber('5');

    await waitFor(() => expect(screen.getByTestId('guest-results')).toBeTruthy());
    expect(screen.getByTestId('guest-score')).toHaveTextContent('1 of 3 right');
    expect(screen.getByTestId('guest-save-score')).toHaveTextContent('Save this score: sign up free');
    expect(screen.getByTestId('guest-review-chip-1')).toBeTruthy();
    expect(screen.getByTestId('guest-review-chip-3')).toBeTruthy();
    // The phone remembers the questions and the best score; no answer was ever sent.
    expect([...guestMemory.seen('NC26.4')].sort()).toEqual(['q1', 'q2', 'q3']);
    expect(guestMemory.best('G4Q5')).toBe(1);
    expect(mockGet).toHaveBeenCalledTimes(1);
    for (const [path] of mockPost.mock.calls) expect(path).toBe('/public/events');
  });

  it('pauses a timed quest’s clock while the offer shows, and Sign up opens the sheet', async () => {
    await renderWithProviders(<GuestQuest tile={TIMED} />);
    await waitFor(() => expect(screen.getByTestId('guest-question')).toBeTruthy());
    expect(screen.getByTestId('guest-progress')).toHaveTextContent(/^\d+:\d\d$/);
    await answerNumber('3');
    expect(screen.getByText('Good try. Keep going!')).toBeTruthy();
    expect(screen.getByTestId('guest-progress')).toHaveTextContent('Paused');
    await fireEvent.press(screen.getByTestId('guest-nudge-signup'));
    expect(mockPush).toHaveBeenCalledWith('/sign-up-sheet');
    // Still paused while the sheet is over the quest.
    expect(screen.getByTestId('guest-progress')).toHaveTextContent('Paused');
  });

  it('with sign-up closed, every button says Sign in', async () => {
    mockSignupOpen = false;
    await renderWithProviders(<GuestQuest tile={COUNT} />);
    await waitFor(() => expect(screen.getByTestId('guest-question')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('guest-skip'));
    expect(screen.getByTestId('guest-nudge-signup')).toHaveTextContent('Sign in');
    await fireEvent.press(screen.getByTestId('guest-nudge-close'));
    await fireEvent.press(screen.getByTestId('guest-skip'));
    await fireEvent.press(screen.getByTestId('guest-skip'));
    await waitFor(() => expect(screen.getByTestId('guest-save-score')).toHaveTextContent('Sign in'));
  });
});
