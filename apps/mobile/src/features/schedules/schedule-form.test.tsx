import type { Assignment, Location } from '@tmi/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { ScheduleForm } from './schedule-form-sheet';

const mockAssignments = jest.fn();
const mockCreate = jest.fn();
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: { id: 'admin-1', roles: ['admin'] } }),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/features/teaching/api', () => ({ useAssignments: () => mockAssignments() }));
jest.mock('@/features/teaching/session-notes', () => ({ NoteField: () => null }));
jest.mock('./api', () => ({
  useSchedules: () => ({ isPending: true }),
  useCreateSchedule: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateSchedule: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const TUTOR = '00000000-0000-4000-8000-000000000003';
const STUDENT = '00000000-0000-4000-8000-000000000008';

function place(id: string, owner: string, kind: Location['kind'], name: string): Location {
  return {
    id,
    owner_user_id: owner,
    owner_name: owner === TUTOR ? 'Alex Chen' : 'Sofia Okafor',
    name,
    kind,
    address: null,
    reminder_minutes: 0,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  };
}

const HOME = '0c100000-0000-4000-8000-000000000003';
const ROOM = '0c100000-0000-4000-8000-000000000001';
const ONLINE = '0c100000-0000-4000-8000-000000000002';

function pairing(locations: Location[]): Assignment {
  return {
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
    locations,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

describe('the schedule form’s places', () => {
  beforeEach(() => mockCreate.mockReset());

  it('starts a new schedule at the tutor’s in-person place and sends it', async () => {
    mockAssignments.mockReturnValue({
      isSuccess: true,
      data: {
        data: [
          pairing([
            place(HOME, STUDENT, 'physical', 'Home'),
            place(ROOM, TUTOR, 'physical', 'Institute, room 2'),
            place(ONLINE, TUTOR, 'virtual', 'Online room'),
          ]),
        ],
      },
    });
    mockCreate.mockResolvedValue({});
    await renderWithProviders(<ScheduleForm existing={null} />);
    expect(screen.getByLabelText('In person: Institute, room 2. Change')).toBeOnTheScreen();
    expect(screen.getByLabelText('Online: None. Change')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('schedule-form-save'));
    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockCreate.mock.calls[0][0].location_ids).toEqual([ROOM]);
  });

  it('refuses a schedule with no place, under the pickers', async () => {
    mockAssignments.mockReturnValue({ isSuccess: true, data: { data: [pairing([])] } });
    await renderWithProviders(<ScheduleForm existing={null} />);
    expect(
      screen.getByText('This pairing has no locations yet. An admin adds them on the Pairings page.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('schedule-form-save'));
    expect(await screen.findByText('Choose at least one location.')).toBeOnTheScreen();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
