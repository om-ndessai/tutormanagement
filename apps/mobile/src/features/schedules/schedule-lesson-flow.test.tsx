// Schedule a lesson (UI upgrades U5): the place cards keep one of each kind, the mode follows the
// place, and the Review says the lesson as a sentence before the one request goes.
import type { Assignment, Location } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { onFormSaved, type FormSaved } from '@/lib/form-bridge';
import { renderWithProviders } from '@/test/render';
import { ScheduleLessonFlow, presetPairing, scheduleMode, togglePlace } from './schedule-lesson-flow';

const mockAssignments = jest.fn();
const mockCreate = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', roles: ['admin'] } }),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock('@/hooks/use-unsaved-changes', () => ({
  useDirty: () => false,
  useUnsavedChangesGuard: () => ({ leave: (close: () => void) => close() }),
}));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/features/teaching/api', () => ({ useAssignments: () => mockAssignments() }));
jest.mock('@/features/teaching/session-notes', () => ({ NoteField: () => null }));
jest.mock('./api', () => ({ useCreateSchedule: () => ({ mutateAsync: mockCreate, isPending: false }) }));

const TUTOR = '00000000-0000-4000-8000-000000000003';
const STUDENT = '00000000-0000-4000-8000-000000000008';
const ROOM = '0c100000-0000-4000-8000-000000000001';
const ONLINE = '0c100000-0000-4000-8000-000000000002';

function place(id: string, kind: Location['kind'], name: string): Location {
  return {
    id,
    owner_user_id: TUTOR,
    owner_name: 'Alex Chen',
    name,
    kind,
    address: null,
    reminder_minutes: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

const pairing: Assignment = {
  id: 'a1',
  tutor_user_id: TUTOR,
  tutor_name: 'Alex Chen',
  student_user_id: STUDENT,
  student_name: 'Sofia Okafor',
  rate_in_person_cents: null,
  rate_virtual_cents: null,
  effective_rate_in_person_cents: null,
  effective_rate_virtual_cents: null,
  is_active: true,
  notes: null,
  locations: [place(ROOM, 'physical', 'Institute, room 2'), place(ONLINE, 'virtual', 'Online room')],
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
};

describe('the place rules', () => {
  it('keeps one place of each kind, and a second tap takes it off', () => {
    const none = { physicalId: '', virtualId: '' };
    const room = togglePlace(none, { id: ROOM, kind: 'physical' });
    expect(room).toEqual({ physicalId: ROOM, virtualId: '' });
    expect(togglePlace(room, { id: 'other', kind: 'physical' })).toEqual({ physicalId: 'other', virtualId: '' });
    expect(togglePlace(room, { id: ONLINE, kind: 'virtual' })).toEqual({ physicalId: ROOM, virtualId: ONLINE });
    expect(togglePlace(room, { id: ROOM, kind: 'physical' })).toEqual(none);
  });

  it('takes the mode from the place, and asks only when there are both', () => {
    expect(scheduleMode([{ kind: 'virtual' }], 'in_person')).toBe('virtual');
    expect(scheduleMode([{ kind: 'physical' }], 'virtual')).toBe('in_person');
    expect(scheduleMode([{ kind: 'physical' }, { kind: 'virtual' }], 'virtual')).toBe('virtual');
  });
});

describe('Schedule a lesson', () => {
  beforeEach(() => mockCreate.mockReset());

  it('walks to a Review said as a sentence, then sends one schedule', async () => {
    mockAssignments.mockReturnValue({ isPending: false, isError: false, data: { data: [pairing] } });
    mockCreate.mockResolvedValue({ data: { id: 'schedule-1' } });
    await renderWithProviders(<ScheduleLessonFlow />);
    // The only pairing is chosen already.
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    await fireEvent.press(screen.getByTestId('schedule-form-day-1'));
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    // The tutor's in-person place came with the pairing; add the online room as well, usually online.
    await fireEvent.press(screen.getByTestId(`schedule-place-${ONLINE}`));
    await fireEvent.press(screen.getByTestId('schedule-usual-virtual'));
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    expect(screen.getByTestId('schedule-review-sentence')).toHaveTextContent(
      /Every Monday, 4:00–5:00 PM, online in Online room, or at Institute, room 2, starting \w{3} \d+/,
    );
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      tutor_user_id: TUTOR,
      student_user_id: STUDENT,
      day_of_week: 1,
      start_time: '16:00',
      duration_minutes: 60,
      mode: 'virtual',
      location_ids: [ROOM, ONLINE],
      ends_on: null,
    });
  });

  it('will not leave Where with no place chosen', async () => {
    mockAssignments.mockReturnValue({
      isPending: false,
      isError: false,
      data: { data: [{ ...pairing, locations: [] }] },
    });
    await renderWithProviders(<ScheduleLessonFlow />);
    for (let step = 0; step < 3; step += 1) await fireEvent.press(screen.getByTestId('step-flow-next'));
    expect(screen.getByText('This pairing has no locations yet. An admin adds them on the Pairings page.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    expect(await screen.findByText('Choose at least one location.')).toBeTruthy();
    expect(screen.queryByTestId('schedule-review-sentence')).toBeNull();
  });

  // Phase 76 (JF21): "Set a weekly lesson" after adding someone opens on their pairing, and says when it is saved.
  it('?assignment= opens on that pairing at When, and announces the schedule it made', async () => {
    const other: Assignment = { ...pairing, id: 'a2', student_name: 'Leo Marsh', student_user_id: 'student-2' };
    mockAssignments.mockReturnValue({ isPending: false, isError: false, isFetching: false, data: { data: [other, pairing] } });
    mockCreate.mockResolvedValue({ data: { id: 'schedule-9' } });
    const heard: FormSaved[] = [];
    const stop = onFormSaved((event) => heard.push(event));
    await renderWithProviders(<ScheduleLessonFlow assignmentId="a1" />);
    // Straight to When: the pairing is chosen, though there are two.
    expect(screen.getByText('When is it?')).toBeTruthy();
    for (let step = 0; step < 3; step += 1) await fireEvent.press(screen.getByTestId('step-flow-next'));
    expect(screen.getByTestId('schedule-review-sentence')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('step-flow-next'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ tutor_user_id: TUTOR, student_user_id: STUDENT });
    await waitFor(() => expect(heard).toEqual([{ form: 'schedule', id: 'schedule-9' }]));
    stop();
  });

  it('waits for the fresh list when the named pairing is not in the cached one yet', async () => {
    mockAssignments.mockReturnValue({ isPending: false, isError: false, isFetching: true, data: { data: [] } });
    await renderWithProviders(<ScheduleLessonFlow assignmentId="a1" />);
    expect(screen.getByTestId('schedule-lesson-loading')).toBeTruthy();
  });

  it('presetPairing: the named pairing, or none for one the reader may not schedule', () => {
    expect(presetPairing([pairing], 'a1')).toBe(pairing);
    expect(presetPairing([pairing], 'nope')).toBeNull();
    expect(presetPairing([pairing], undefined)).toBeNull();
  });
});
