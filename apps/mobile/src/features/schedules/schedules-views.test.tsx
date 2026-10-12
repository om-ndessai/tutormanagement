import type { ScheduleCancellation, UpcomingSession, VisibleSchedule } from '@tmi/shared';
import { fireEvent, screen } from '@testing-library/react-native';

import { upcoming } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { CancelledLessonsPanel, orderCancellations } from './cancelled-lessons-panel';
import { ScheduleCard } from './schedule-card';

const mockOccurrences = jest.fn();
const mockCancellations = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useOrgTimeZone: () => 'America/New_York' }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/components/toast', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), info: jest.fn() }),
}));
jest.mock('./api', () => ({
  useScheduleOccurrences: () => mockOccurrences(),
  useScheduleCancellations: () => mockCancellations(),
  useRestoreLesson: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

const ID = '70000000-0000-4000-8000-000000000001';

function schedule(overrides: Partial<VisibleSchedule> = {}): VisibleSchedule {
  return {
    id: ID,
    tutor_user_id: 'tutor-1',
    tutor_name: 'Alex Chen',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    day_of_week: 2,
    start_time: '16:00',
    duration_minutes: 60,
    mode: 'in_person',
    starts_on: '2026-09-01',
    ends_on: '2099-12-18',
    location: null,
    notes: null,
    is_active: true,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    cancel_as: 'tutor',
    ...overrides,
  };
}

function cancellation(
  occurs_on: string,
  overrides: Partial<ScheduleCancellation> = {},
): ScheduleCancellation {
  return {
    schedule_id: ID,
    occurs_on,
    start_time: '16:00',
    end_time: '17:00',
    duration_minutes: 60,
    tutor_user_id: 'tutor-1',
    tutor_name: 'Alex Chen',
    student_user_id: 'student-1',
    student_name: 'Sofia Okafor',
    note: 'Away',
    cancelled_by_user_id: 'parent-1',
    cancelled_by_name: 'Maria Okafor',
    cancelled_as: 'parent',
    created_at: '2026-09-01T00:00:00Z',
    can_restore: false,
    ...overrides,
  };
}

const dates = (rows: UpcomingSession[]) => ({
  data: { pages: [{ data: rows, meta: { offset: 0, limit: 6, has_more: false } }] },
  isPending: false,
  hasNextPage: false,
  isFetchingNextPage: false,
  fetchNextPage: jest.fn(),
});

const card = (value: VisibleSchedule, canEdit = false) => (
  <ScheduleCard
    schedule={value}
    canEdit={canEdit}
    datesOpen
    highlight={null}
    downloading={false}
    onToggleDates={jest.fn()}
    onCalendar={jest.fn()}
    onEdit={jest.fn()}
    onRemove={jest.fn()}
  />
);

describe('the schedule', () => {
  beforeEach(() => mockCancellations.mockReturnValue({ data: { data: [] } }));

  it('offers a student no way to cancel, and nobody but the editor Edit and Remove', async () => {
    mockOccurrences.mockReturnValue(dates([upcoming({ schedule_id: ID, occurs_on: '2099-10-13' })]));
    await renderWithProviders(card(schedule({ cancel_as: null })));
    expect(screen.getByTestId(`schedule-date-${ID}-2099-10-13`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`schedule-cancel-${ID}-2099-10-13`)).toBeNull();
    expect(screen.queryByTestId(`schedule-cancel-other-${ID}`)).toBeNull();
    expect(screen.queryByTestId(`schedule-edit-${ID}`)).toBeNull();
    expect(screen.getByTestId(`schedule-calendar-${ID}`)).toBeOnTheScreen();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows a cancelled date struck through with who and why, and Restore only where allowed', async () => {
    const flagged = (can_restore: boolean) =>
      upcoming({
        schedule_id: ID,
        occurs_on: '2099-11-24',
        cancellation: {
          note: 'Thanksgiving',
          cancelled_by_user_id: 'parent-1',
          cancelled_by_name: 'Maria Okafor',
          cancelled_as: 'parent',
          created_at: '2026-09-01T00:00:00Z',
          can_restore,
        },
      });
    mockOccurrences.mockReturnValue(dates([flagged(false)]));
    const view = await renderWithProviders(card(schedule({ cancel_as: 'parent' }), false));
    expect(screen.getByText('by Maria Okafor (the family)')).toBeOnTheScreen();
    expect(screen.getByText('Thanksgiving')).toBeOnTheScreen();
    expect(screen.queryByTestId(`schedule-restore-${ID}-2099-11-24`)).toBeNull();
    // The parent may still cancel other dates of the series.
    expect(screen.getByTestId(`schedule-cancel-other-${ID}`)).toBeOnTheScreen();
    await view.unmount();

    mockOccurrences.mockReturnValue(dates([flagged(true)]));
    await renderWithProviders(card(schedule(), true));
    expect(screen.getByTestId(`schedule-restore-${ID}-2099-11-24`)).toBeOnTheScreen();
    expect(screen.getByTestId(`schedule-edit-${ID}`)).toBeOnTheScreen();
  });

  it('orders the cancelled panel upcoming first, with Restore only where allowed', async () => {
    const rows = [cancellation('2026-09-20'), cancellation('2026-09-27'), cancellation('2026-10-13')];
    expect(orderCancellations(rows, '2026-10-08').map((row) => row.occurs_on)).toEqual([
      '2026-10-13',
      '2026-09-27',
      '2026-09-20',
    ]);

    mockCancellations.mockReturnValue({
      data: { data: [cancellation('2099-10-13', { can_restore: true }), cancellation('2099-10-20')] },
    });
    await renderWithProviders(<CancelledLessonsPanel />);
    expect(screen.getByTestId('cancelled-lessons-panel')).toBeOnTheScreen();
    // Folded to one line until opened.
    expect(screen.queryByTestId(`cancelled-row-${ID}-2099-10-13`)).toBeNull();
    await fireEvent.press(screen.getByTestId('cancelled-lessons-toggle'));
    expect(screen.getByTestId(`cancelled-restore-${ID}-2099-10-13`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`cancelled-restore-${ID}-2099-10-20`)).toBeNull();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('renders no panel when nothing was cancelled', async () => {
    mockCancellations.mockReturnValue({ data: { data: [] } });
    await renderWithProviders(<CancelledLessonsPanel />);
    expect(screen.queryByTestId('cancelled-lessons-panel')).toBeNull();
  });
});
