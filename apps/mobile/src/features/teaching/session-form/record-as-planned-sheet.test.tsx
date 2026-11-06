// Recording the lesson at hand from Next up (UI upgrades U4): the quick sheet is filled from the
// schedule, "It ran as planned" records those times, "Different times" opens the time fields first,
// and once recorded it offers the write-up of that lesson. No money anywhere on it.
//
// Phase 75 (JF19, JF30): it is "Record a lesson" with "Write up the lesson" (the full form, filled in) beside "It ran
// as planned"; a lesson with the reader's own draft opens on that draft, never a second one; a refusal is said once.
import type { Assignment, SessionDraft } from '@tmi/shared';
import { ApiRequestError } from '@/lib/api-client';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { session } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { RecordAsPlannedSheet } from './record-as-planned-sheet';
import { studentItems, whenIssues } from './record-lesson-flow';

const MOCK_TUTOR = '00000000-0000-4000-8000-000000000003';
const MOCK_STUDENT = '00000000-0000-4000-8000-000000000009';
const mockRecord = jest.fn();
const mockReplace = jest.fn();
let mockDrafts: SessionDraft[] = [];
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: jest.fn(),
    canGoBack: () => true,
  },
  useNavigation: () => ({ isFocused: () => true }),
  useFocusEffect: jest.fn(),
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
  useMyDrafts: () => ({ isPending: false, isError: false, data: { data: mockDrafts } }),
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
  mockDrafts = [];
});

test('is filled from the schedule and records it as planned, then offers the write-up', async () => {
  mockRecord.mockResolvedValue({ data: session({ id: 'new-1', student_name: 'Ben Whitfield' }) });
  await renderWithProviders(<RecordAsPlannedSheet prefill={prefill} place="Library" />);
  expect(screen.getByTestId('record-quick-student')).toHaveTextContent('Ben Whitfield');
  expect(screen.getByTestId('record-quick-times')).toHaveTextContent(/4:00.*5:30 PM · 1 hr 30 min/);
  expect(screen.getByTestId('record-quick-place')).toHaveTextContent('Library · In person');
  expect(screen.getByText('Record a lesson')).toBeTruthy();
  expect(screen.getByText('It ran as planned')).toBeTruthy();
  expect(screen.getByTestId('record-quick-write-up')).toHaveTextContent(/Write up the lesson/);
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
  expect(screen.getByText('Lesson recorded.')).toBeTruthy();
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

test('the When step refuses an end before the start, and a blank record until it is dated', () => {
  expect(whenIssues({ occurredOn: DAY, startedAt: '16:00', endedAt: '17:00' })).toBeNull();
  expect(whenIssues({ occurredOn: DAY, startedAt: '17:00', endedAt: '16:00' })).toEqual({
    ended_at: 'The end time must be after the start time.',
  });
  // "Another lesson" (Phase 75): nothing is dated today by default -- the day is asked for.
  expect(whenIssues({ occurredOn: '', startedAt: '16:00', endedAt: '17:00' })).toEqual({
    occurred_on: 'Choose the day of the lesson.',
  });
});

test('"Write up the lesson" opens the full form filled in from the schedule (Phase 75, JF30)', async () => {
  await renderWithProviders(<RecordAsPlannedSheet prefill={{ ...prefill, homeworkReview: 'Last time: p. 12' }} />);
  await fireEvent.press(screen.getByTestId('record-quick-write-up'));
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/record-lesson',
    params: {
      student: MOCK_STUDENT,
      tutor: MOCK_TUTOR,
      date: DAY,
      start: '16:00',
      end: '17:30',
      mode: 'in_person',
      homework: 'Last time: p. 12',
    },
  });
  expect(mockRecord).not.toHaveBeenCalled();
});

test('a lesson with the reader’s own draft opens on that draft, never a second one (JF19)', async () => {
  mockDrafts = [
    {
      id: 'draft-old',
      tutor_user_id: MOCK_TUTOR,
      student_user_id: MOCK_STUDENT,
      occurred_on: DAY,
      updated_at: '2020-03-02T16:10:00Z',
    } as SessionDraft,
    {
      id: 'draft-1',
      tutor_user_id: MOCK_TUTOR,
      student_user_id: MOCK_STUDENT,
      occurred_on: DAY,
      updated_at: '2020-03-02T17:43:00Z',
    } as SessionDraft,
    // Another day's draft of the same pair is not this lesson's.
    { id: 'draft-other', tutor_user_id: MOCK_TUTOR, student_user_id: MOCK_STUDENT, occurred_on: '2020-02-24', updated_at: '2020-03-02T18:00:00Z' } as SessionDraft,
  ];
  await renderWithProviders(<RecordAsPlannedSheet prefill={prefill} />);
  expect(screen.queryByText('It ran as planned')).toBeNull();
  // The newest of this lesson's drafts, on the space's clock (17:43 UTC is 12:43 PM in New York).
  expect(screen.getByTestId('record-quick-draft-saved')).toHaveTextContent('Draft saved Mon, Mar 2, 2020, 12:43 PM');
  await fireEvent.press(screen.getByTestId('record-quick-draft-save'));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/record-lesson', params: { draft: 'draft-1' } });
  expect(mockRecord).not.toHaveBeenCalled();
});

test('a refusal for a price not set is said once, in the reader’s words (JF18)', async () => {
  const words = "Ask the office to set Ben's price.";
  mockRecord.mockRejectedValue(new ApiRequestError(422, 'validation_failed', words, { mode: [words] }));
  await renderWithProviders(<RecordAsPlannedSheet prefill={prefill} />);
  await act(async () => {
    await fireEvent.press(screen.getByTestId('record-quick-save'));
  });
  expect(screen.getByTestId('record-quick-error')).toHaveTextContent(words);
  expect(screen.getAllByText(words)).toHaveLength(1);
});
