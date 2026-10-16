import type { Location } from '@tmi/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';

import { upcoming } from '@/test/fixtures';
import { renderWithProviders } from '@/test/render';
import { LessonReminder, LessonReminderSheet } from './lesson-reminder';

const mockUpcoming = jest.fn();
const mockUser = { id: 'tutor-1', roles: ['tutor'] };
jest.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({ user: mockUser }),
  useOrgTimeZone: () => 'America/New_York',
}));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/features/schedules/api', () => ({ useUpcomingSessions: () => mockUpcoming() }));

function place(overrides: Partial<Location> = {}): Location {
  return {
    id: 'loc-1',
    owner_user_id: 'tutor-1',
    owner_name: 'Alex Chen',
    name: 'Institute, room 2',
    kind: 'physical',
    address: '1 Main St',
    reminder_minutes: 15,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const lesson = upcoming({
  locations: [
    place(),
    place({ id: 'loc-2', kind: 'virtual', name: 'Online room', address: 'https://meet.example.com/x' }),
  ],
});

describe('LessonReminder', () => {
  it('says when, who and where, with the online room as a link and no money', async () => {
    await renderWithProviders(<LessonReminder lesson={lesson} minutes={10} onDismiss={jest.fn()} />);
    expect(screen.getByTestId('lesson-reminder')).toBeTruthy();
    expect(screen.getByText('Your lesson starts in 10 minutes')).toBeTruthy();
    expect(screen.getByText(/Alex Chen with Sofia Okafor/)).toBeTruthy();
    expect(screen.getByText(/Institute, room 2/)).toBeTruthy();
    expect(screen.getByText('1 Main St')).toBeTruthy();
    expect(screen.getByTestId('lesson-reminder-link-loc-2')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });
});

describe('LessonReminderSheet', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.useFakeTimers();
    // 15:50 in New York on the lesson's day: ten minutes before it starts.
    jest.setSystemTime(new Date('2026-10-08T19:50:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('rises when a lesson is due, and a dismissal is remembered on the phone', async () => {
    mockUpcoming.mockReturnValue({ data: { pages: [{ data: [lesson] }] } });
    await renderWithProviders(<LessonReminderSheet />);
    expect(await screen.findByTestId('lesson-reminder')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('lesson-reminder-dismiss'));
    expect(screen.queryByTestId('lesson-reminder')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem('tmi.remindersDismissed')) ?? '[]')).toEqual([
      'sch-1:2026-10-08',
    ]);
  });

  it('skips a dismissed date for the next one due', async () => {
    await AsyncStorage.setItem('tmi.remindersDismissed', JSON.stringify(['sch-1:2026-10-08']));
    const other = upcoming({ ...lesson, schedule_id: 'sch-2', student_name: 'Ben Okafor' });
    mockUpcoming.mockReturnValue({ data: { pages: [{ data: [lesson, other] }] } });
    await renderWithProviders(<LessonReminderSheet />);
    expect(await screen.findByText(/Alex Chen with Ben Okafor/)).toBeTruthy();
    expect(screen.queryByText(/Alex Chen with Sofia Okafor/)).toBeNull();
  });

  it('opens when the window does, on the 30-second re-check', async () => {
    // 15:30: thirty minutes before, outside a 15-minute reminder.
    jest.setSystemTime(new Date('2026-10-08T19:30:00Z'));
    mockUpcoming.mockReturnValue({ data: { pages: [{ data: [lesson] }] } });
    await renderWithProviders(<LessonReminderSheet />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('lesson-reminder')).toBeNull();

    await act(async () => {
      jest.setSystemTime(new Date('2026-10-08T19:46:00Z'));
      jest.advanceTimersByTime(30_000);
    });
    expect(await screen.findByTestId('lesson-reminder')).toBeTruthy();
  });
});
