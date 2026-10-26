// Phase 56: Your shares on the Quest screen.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { MySharesPanel } from './my-shares-panel';

const mockGet = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { get: (p: string) => mockGet(p), delete: (p: string) => mockDelete(p) },
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/providers/auth-provider', () => ({ useOrgTimeZone: () => 'America/New_York' }));
const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock('@/components/toast', () => ({ useToast: () => mockToast }));

const card = { kind: 'level_finished', level_id: 'NC26.4', level_label: 'Grade 4', answered: 12, correct: 10 };
const row = (id: string, withdrawn_at: string | null) => ({
  id, kind: 'level_finished', card, first_name: null, created_at: '2026-10-26T00:00:00Z', expires_at: '2027-10-26T00:00:00Z', withdrawn_at,
});

beforeEach(() => jest.clearAllMocks());

describe('MySharesPanel', () => {
  it('is hidden while there are no live shares', async () => {
    mockGet.mockResolvedValue({ data: [row('gone1234', '2026-10-26T01:00:00Z')] });
    await renderWithProviders(<MySharesPanel />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/shares'));
    expect(screen.queryByTestId('my-shares')).toBeNull();
  });

  it('lists each live one, and withdraws it', async () => {
    mockGet.mockResolvedValue({ data: [row('live1234', null)] });
    mockDelete.mockResolvedValue(undefined);
    await renderWithProviders(<MySharesPanel />);
    expect(await screen.findByText('Finished Grade 4 · 12 questions')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('my-share-withdraw-live1234'));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/shares/live1234'));
    expect(mockToast.success).toHaveBeenCalledWith('Withdrawn.');
  });
});
