// Phase 56: Share -- hidden for a child; Make the link, the card and the text; Withdraw.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';

import { renderWithProviders } from '@/test/render';
import { ShareButton } from './share-button';

const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: jest.fn(), post: (p: string, b?: unknown) => mockPost(p, b), delete: (p: string) => mockDelete(p) },
}));
const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));
const mockNotice = { success: jest.fn(), error: jest.fn() };
jest.mock('@/features/quest/quest-notice', () => ({ useQuestNotice: () => mockNotice }));
jest.mock('@/lib/server', () => ({ serverOrigin: () => 'http://localhost:8787' }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/card.png') }));

const INPUT = { kind: 'game_result' as const, game_id: '00000000-0000-4000-8000-000000000001' };
const SHARE = {
  id: 'abcDEF1234567890',
  kind: 'game_result',
  card: {
    kind: 'game_result', level_id: 'NC26.4', level_label: 'Grade 4', mode: 'count', knockout: false, single: true,
    place: null, teams: 1, correct: 2, wrong: 1, skipped: 0, total: 3, score: 1, marks: ['right', 'wrong', 'right'],
  },
  first_name: 'Anita',
  created_at: '2026-10-26T00:00:00Z',
  expires_at: '2027-10-26T00:00:00Z',
  withdrawn_at: null,
};

beforeEach(() => jest.clearAllMocks());

describe('ShareButton', () => {
  it('is not there for a child a space added', async () => {
    mockAuth.mockReturnValue({ user: { roles: ['student'] }, account: null });
    await renderWithProviders(<ShareButton input={INPUT} />);
    expect(screen.queryByTestId('share-button')).toBeNull();
  });

  it('does not offer a teen their first name', async () => {
    mockAuth.mockReturnValue({ user: { roles: ['student'] }, account: { age_band: 'teen' } });
    await renderWithProviders(<ShareButton input={INPUT} />);
    await fireEvent.press(screen.getByTestId('share-button'));
    expect(await screen.findByTestId('share-make')).toBeTruthy();
    expect(screen.queryByTestId('share-show-name')).toBeNull();
  });

  it('makes the link with the first name an adult chose, shows the card and the text, and withdraws it', async () => {
    mockAuth.mockReturnValue({ user: { roles: ['parent'] }, account: null });
    mockPost.mockResolvedValue({ data: SHARE });
    mockDelete.mockResolvedValue(undefined);
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await renderWithProviders(<ShareButton input={INPUT} label="Share the result" />);
    await fireEvent.press(screen.getByText('Share the result'));
    await fireEvent.press(await screen.findByTestId('share-show-name'));
    await fireEvent.press(screen.getByTestId('share-make'));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/shares', { ...INPUT, show_first_name: true }));
    expect(await screen.findByTestId('share-card')).toBeTruthy();
    const text = 'Aimtrue Quest · Anita · Grade 4 · 2/3 🟩🟥🟩\nhttp://localhost:8787/s/abcDEF1234567890';
    expect(screen.getByTestId('share-text')).toHaveTextContent(text);

    await fireEvent.press(screen.getByTestId('share-system'));
    expect(share).toHaveBeenCalledWith({ message: text, url: 'http://localhost:8787/s/abcDEF1234567890' });

    await fireEvent.press(screen.getByTestId('share-withdraw'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/shares/abcDEF1234567890'));
    expect(mockNotice.success).toHaveBeenCalledWith('Withdrawn: the link now says it is no longer available.');
    share.mockRestore();
  });

  it('says the server’s refusal in its words', async () => {
    mockAuth.mockReturnValue({ user: { roles: ['tutor'] }, account: null });
    const { ApiRequestError } = jest.requireActual('@/lib/api-client');
    mockPost.mockRejectedValue(new ApiRequestError(404, 'not_found', 'There is nothing of yours to share there.'));
    await renderWithProviders(<ShareButton input={INPUT} />);
    await fireEvent.press(screen.getByTestId('share-button'));
    await fireEvent.press(await screen.findByTestId('share-make'));
    expect(await screen.findByText('There is nothing of yours to share there.')).toBeTruthy();
  });
});
