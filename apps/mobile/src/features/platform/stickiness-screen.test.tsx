import type { StickinessReport, VisitSettingsResponse } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { StickinessScreen } from './stickiness-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useFocusEffect: jest.fn() }));

const mockSuccess = jest.fn();
const mockError = jest.fn();
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError, info: jest.fn() }),
}));

const none = { base: 0, count: 0, share: null };
const REPORT: StickinessReport = {
  computed_at: new Date().toISOString(),
  day: '2026-11-03',
  recording: false,
  weekly_active: 12,
  monthly_active: 30,
  wau_over_mau: 0.4,
  days_per_week: null,
  rhythm_kept: none,
  return_after_miss: { base: 10, count: 4, share: 0.4 },
  daily_completion: none,
  weekly: [{ week: '2026-10-26', active: 12 }],
  retention: [
    { hat: 'all', space_kind: 'all', arrival: 'all', cohort: 0, weeks: { '1': none, '4': none, '8': none } },
    { hat: 'tutor', space_kind: 'all', arrival: 'all', cohort: 0, weeks: { '1': none, '4': none, '8': none } },
  ],
};
const VISITS: VisitSettingsResponse = {
  settings: { record: false },
  may_record: false,
  privacy_version: '2026-11-01',
  needs_privacy_version: '2026-11-04',
};

let mockReport: StickinessReport | null = REPORT;
const mockRefresh = jest.fn();
const mockSaveVisits = jest.fn();
jest.mock('./api', () => ({
  useStickiness: () => ({ data: { data: mockReport }, isPending: false, isError: false, refetch: jest.fn() }),
  useVisitSettings: () => ({ data: { data: VISITS }, refetch: jest.fn() }),
  useRefreshStickiness: () => ({ mutateAsync: mockRefresh, isPending: false }),
  useSaveVisitSettings: () => ({ mutateAsync: mockSaveVisits, isPending: false }),
}));

describe('StickinessScreen', () => {
  beforeEach(() => {
    mockReport = REPORT;
    mockSuccess.mockReset();
    mockRefresh.mockReset();
  });

  it('shows totals, holds the visit switch, and leaves small groups out', async () => {
    await renderWithProviders(<StickinessScreen />);
    expect(screen.getByTestId('stickiness-visits-line').props.children).toMatch(/^Waiting for the privacy notice of 2026-11-04/);
    expect(screen.getByTestId('stickiness-visits-toggle')).toBeDisabled();
    expect(screen.getByTestId('stat-active-this-week-value').props.children).toBe('12');
    expect(screen.getByTestId('stat-weekly-over-monthly-value').props.children).toBe('40%');
    expect(screen.getByTestId('stat-kept-3-days-a-week-value').props.children).toBe('—');
    expect(screen.getByText('came the week after · 4 of 10')).toBeTruthy();
    expect(screen.getByTestId('stickiness-days-empty')).toBeTruthy();
    expect(screen.getByTestId('stickiness-row-all-all-all')).toBeTruthy();
    expect(screen.queryByTestId('stickiness-row-tutor-all-all')).toBeNull();
    expect(screen.getByText('Everyone')).toBeTruthy();
  });

  it('says a bar’s value when it is pressed', async () => {
    await renderWithProviders(<StickinessScreen />);
    await fireEvent.press(screen.getByLabelText('Week of 2026-10-26: 12 people'));
    expect(screen.getByTestId('stickiness-weekly-picked').props.children).toBe('Week of 2026-10-26: 12 people');
  });

  it('recomputes, with a toast', async () => {
    mockRefresh.mockResolvedValue({ data: REPORT });
    await renderWithProviders(<StickinessScreen />);
    await fireEvent.press(screen.getByTestId('stickiness-refresh'));
    await waitFor(() => expect(mockSuccess).toHaveBeenCalledWith('Figures recomputed.'));
  });

  it('says there are no figures yet', async () => {
    mockReport = null;
    await renderWithProviders(<StickinessScreen />);
    expect(screen.getByTestId('stickiness-empty')).toBeTruthy();
  });
});
