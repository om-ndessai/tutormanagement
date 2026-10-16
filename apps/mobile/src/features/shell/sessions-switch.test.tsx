// Lessons | Schedule (the tab bar, revised 2026-10-15): Schedule lives inside Sessions, and the
// switch heading both screens moves between the two sibling tabs.
import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test/render';
import { SessionsSwitch } from './sessions-switch';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ router: { navigate: (href: unknown) => mockNavigate(href) } }));

beforeEach(() => mockNavigate.mockClear());

test('on Lessons: Lessons is chosen, and Schedule goes to the schedule', async () => {
  await renderWithProviders(<SessionsSwitch current="lessons" />);
  expect(screen.getByTestId('sessions-switch-lessons').props.accessibilityState).toMatchObject({
    selected: true,
  });
  expect(screen.getByTestId('sessions-switch-schedule').props.accessibilityState).toMatchObject({
    selected: false,
  });
  await fireEvent.press(screen.getByTestId('sessions-switch-lessons'));
  expect(mockNavigate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId('sessions-switch-schedule'));
  expect(mockNavigate).toHaveBeenCalledWith('/schedule');
});

test('on Schedule: Lessons goes back to the sessions list', async () => {
  await renderWithProviders(<SessionsSwitch current="schedule" />);
  expect(screen.getByRole('tab', { name: 'Schedule', selected: true })).toBeTruthy();
  await fireEvent.press(screen.getByTestId('sessions-switch-lessons'));
  expect(mockNavigate).toHaveBeenCalledWith('/sessions');
});
