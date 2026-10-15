// Recording the lesson at hand from Next up (UI upgrades U4): the quick sheet is filled from the
// schedule, "It ran as planned" records those times, "Different times" opens the time fields first,
// and once recorded it offers the write-up of that lesson. No money anywhere on it.
import type { Assignment } from '@tmi/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { RecordAsPlannedSheet } from './record-as-planned-sheet';
import { studentItems, whenIssues } from './record-lesson-flow';

const MOCK_TUTOR = '00000000-0000-4000-8000-000000000003';
const MOCK_STUDENT = '00000000-0000-4000-8000-000000000009';
const mockRecord = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useDirty: () => false,
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: MOCK_TUTOR, roles: ['tutor'] } }),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('@/components/connectivity', () => ({ useOffline: () => false }));

const mockPairing = {
  id: 'pair-1',
  tutor_user_id: MOCK_TUTOR,
  tutor_name: 'Alex Chen',
  student_user_id: MOCK_STUDENT,
  student_name: 'Ben Whitfield',
  rate_in_person_cents: 6000,
  rate_virtual_cents: 6000,
  effective_rate_in_person_cents: 6000,
  effective_rate_virtual_cents: 6000,
  is_active: true,
  notes: null,
  locations: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as Assignment;

jest.mock('../api', () => ({
  useAssignments: () => ({ isPending: false, isError: false, data: { data: [mockPairing] } }),
  useRecordSession: () => ({ mutateAsync: mockRecord, isPending: false }),
}));

// Yesterday, so the date never clamps whatever day the test runs.
const DAY = '2020-03-02';
const prefill = {
  student: MOCK_STUDENT,
  tutor: MOCK_TUTOR,
  date: DAY,
  start: '16:00',
  end: '17:30',
  mode: 'in_person' as const,
};

function allText(): string {
  return JSON.stringify(screen.toJSON());
}

beforeEach(() => {
  mockRecord.mockReset();
  mockReplace.mockReset();
});

test('is filled from the schedule and records it as planned, then offers the write-up', async () => {
  mockRecord.mockResolvedValue({ data: session({ id: 'new-1', student_name: 'Ben Whitfield' }) });
  await renderWithProviders(<RecordAsPlannedSheet prefill={prefill} place="Library" />);
  expect(screen.getByTestId('record-quick-student')).toHaveTextContent('Ben Whitfield');
  expect(screen.getByTestId('record-quick-times')).toHaveTextContent(/4:00.*5:30 PM · 1 hr 30 min/);
  expect(screen.getByTestId('record-quick-place')).toHaveTextContent('Library · In person');
  expect(screen.getByText('It ran as planned')).toBeTruthy();
  expect(screen.queryByTestId('record-quick-start')).toBeNull();
  expect(allText()).not.toMatch(/\$/);

  await act(async () => {
    await fireEvent.press(screen.getByTestId('record-quick-save'));
  });
  expect(mockRecord).toHaveBeenCalledWith(
    expect.objectContaining({
      tutor_user_id: MOCK_TUTOR,
      student_user_id: MOCK_STUDENT,
      occurred_on: DAY,
      started_at: '16:00',
      ended_at: '17:30',
      mode: 'in_person',
    }),
  );
  // No price is ever sent: the server derives it.
  expect(JSON.stringify(mockRecord.mock.calls[0][0])).not.toMatch(/cents/);
  expect(screen.getByText('Session recorded.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('record-quick-done-save'));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/record-lesson', params: { id: 'new-1' } });
});

test('"Different times" opens the time fields and the action says Record lesson', async () => {
  await renderWithProviders(<RecordAsPlannedSheet prefill={prefill} />);
  await fireEvent.press(screen.getByTestId('record-quick-different'));
  expect(screen.getByTestId('record-quick-start')).toBeTruthy();
  expect(screen.getByTestId('record-quick-end')).toBeTruthy();
  expect(screen.getByText('Record lesson')).toBeTruthy();
  expect(screen.queryByTestId('record-quick-different')).toBeNull();
});

test('refuses a lesson that is not one of the reader’s pairings', async () => {
  await renderWithProviders(<RecordAsPlannedSheet prefill={{ ...prefill, student: 'someone-else' }} />);
  expect(screen.getByText('This lesson is not one of yours to record.')).toBeTruthy();
  expect(screen.queryByTestId('record-quick-save')).toBeNull();
});

test('the record flow lists the pairings, naming the tutor only for the office', () => {
  expect(studentItems([mockPairing], false)).toEqual([
    {
      id: 'pair-1',
      title: 'Ben Whitfield',
      description: undefined,
      avatarName: 'Ben Whitfield',
      keywords: undefined,
    },
  ]);
  expect(studentItems([mockPairing], true)[0]).toMatchObject({
    description: 'with Alex Chen',
    keywords: 'Alex Chen',
  });
});

test('the When step refuses an end before the start', () => {
  expect(whenIssues({ startedAt: '16:00', endedAt: '17:00' })).toBeNull();
  expect(whenIssues({ startedAt: '17:00', endedAt: '16:00' })).toEqual({
    ended_at: 'The end time must be after the start time.',
  });
});
