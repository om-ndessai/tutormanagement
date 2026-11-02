// Phase 63 (P10, P12): the guest Play home -- the grade's open tiles large and its locked ones as the
// offer, the grade remembered on the phone, the home bar, Sign in one tap away, and a signed-in person
// sent on to their space.
import { fireEvent, screen } from '@testing-library/react-native';
import type { GuestConfig, GuestTile } from '@tmi/shared';

import { renderWithProviders } from '@/test/render';
import { GuestHome } from './guest-home';
import { guestMemory, resetGuestMemoryForTests } from './guest-store';

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
    home_bar: 'Playing as a guest. Sign up free to save scores and unlock every quest.',
  },
  tiles: [
    tile('G3Q5', 'NC26.3', false, 'Grade 3 · 5 questions'),
    tile('G4Q5', 'NC26.4', false, 'Grade 4 · 5 questions'),
    tile('G4T10', 'NC26.4', true, 'Grade 4 · 10 minutes'),
  ],
  member_counts: { 'NC26.4': 1234 },
};

let mockStatus = 'unauthenticated';
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ status: mockStatus, config: { signup_open: true, guest: mockGuest } }),
}));

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockStatus = 'unauthenticated';
  resetGuestMemoryForTests({});
});

describe('GuestHome (Phase 63)', () => {
  it('opens on Grade 4: its open tile large, its locked one the offer', async () => {
    await renderWithProviders(<GuestHome />);
    expect(screen.getByTestId('guest-home-bar')).toHaveTextContent(mockGuest.settings.home_bar);
    expect(screen.getByTestId('guest-tile-G4Q5')).toBeTruthy();
    expect(screen.queryByTestId('guest-tile-G3Q5')).toBeNull();
    await fireEvent.press(screen.getByTestId('guest-locked-G4T10'));
    expect(screen.getByText('G4T10 is free with an account')).toBeTruthy();
    expect(screen.getByText('1,200+ more Grade 4 questions, never repeated')).toBeTruthy();
    expect(screen.getByTestId('guest-nudge-close')).toHaveTextContent('Not now');
    await fireEvent.press(screen.getByTestId('guest-nudge-signup'));
    expect(mockPush).toHaveBeenCalledWith('/sign-up-sheet');
  });

  it('plays a tile in one tap, and remembers the grade on the phone', async () => {
    await renderWithProviders(<GuestHome />);
    await fireEvent.press(screen.getByTestId('guest-grade-NC26.3'));
    expect(guestMemory.grade()).toBe('NC26.3');
    await fireEvent.press(screen.getByTestId('guest-tile-G3Q5'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/play/[code]', params: { code: 'G3Q5' } });
    await fireEvent.press(screen.getByTestId('guest-sign-in'));
    expect(mockPush).toHaveBeenCalledWith('/sign-in');
  });

  it('sends someone signed in on to their space', async () => {
    mockStatus = 'authenticated';
    await renderWithProviders(<GuestHome />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
