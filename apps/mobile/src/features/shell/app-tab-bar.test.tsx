// The app's tab bar (UI upgrades U2): the four tabs and More in their order for everyone, the
// create button between Schedule and Progress only for a reader with something to create, and its
// sheet listing that reader's own actions.
import { fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { renderWithProviders } from '@/test/render';
import { AppTabBar } from './app-tab-bar';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: unknown) => mockPush(href) } }));

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
  const { View } = jest.requireActual('react-native');
  const { useImperativeHandle } = jest.requireActual('react');
  return {
    BottomSheetModal: ({ children, ref }: { children: React.ReactNode; ref: React.Ref<unknown> }) => {
      useImperativeHandle(ref, () => ({ present: mockPresent, dismiss: mockDismiss }));
      return children;
    },
    BottomSheetScrollView: View,
    BottomSheetBackdrop: () => null,
  };
});

const mockAuth = jest.fn();
jest.mock('@/providers/auth-provider', () => ({ useAuth: () => mockAuth() }));

const mockPairings = jest.fn();
jest.mock('@/features/teaching/api', () => ({
  useAssignments: () => mockPairings(),
  useActiveSession: () => ({ isSuccess: true, data: { data: { mine: null, all: [] } } }),
}));

const ROUTES = ['dashboard', 'sessions', 'schedule', 'progress', 'more'].map((name) => ({
  key: `${name}-key`,
  name,
}));

function props(index = 0) {
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  return {
    navigation,
    props: {
      state: { index, routes: ROUTES },
      descriptors: {},
      navigation,
      insets: { top: 0, bottom: 34, left: 0, right: 0 },
    } as unknown as BottomTabBarProps,
  };
}

function as(roles: string[]) {
  mockAuth.mockReturnValue({ user: { id: 'me', roles } });
}

beforeEach(() => {
  mockPush.mockClear();
  mockPresent.mockClear();
  mockDismiss.mockClear();
  mockPairings.mockReturnValue({ data: { data: [{ id: 'pairing' }] } });
});

/** The bar's slots, left to right, by testID. */
function slots(): string[] {
  const bar = screen.getByTestId('tab-bar');
  return (bar.props.children as { props: { testID?: string; name?: string } }[])
    .flat()
    .map((child) => (child.props.name ? `tab-${child.props.name}` : 'create-button'));
}

test('a parent: the four tabs and More, and no create button', async () => {
  as(['parent']);
  await renderWithProviders(<AppTabBar {...props().props} />);
  expect(screen.queryByTestId('create-button')).toBeNull();
  for (const label of ['Home', 'Sessions', 'Schedule', 'Progress', 'More']) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.queryByTestId('create-sheet')).toBeNull();
});

test('an admin: the create button sits between Schedule and Progress', async () => {
  as(['admin']);
  await renderWithProviders(<AppTabBar {...props().props} />);
  expect(screen.getByLabelText('Create')).toBeTruthy();
  expect(slots()).toEqual([
    'tab-dashboard',
    'tab-sessions',
    'tab-schedule',
    'create-button',
    'tab-progress',
    'tab-more',
  ]);
});

test('a tab press goes to that tab; the open tab is left to its stack', async () => {
  as(['student']);
  const { navigation, props: barProps } = props(0);
  await renderWithProviders(<AppTabBar {...barProps} />);
  await fireEvent.press(screen.getByTestId('tab-sessions'));
  expect(navigation.emit).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'tabPress', target: 'sessions-key' }),
  );
  expect(navigation.navigate).toHaveBeenCalledWith('sessions', undefined);
  navigation.navigate.mockClear();
  await fireEvent.press(screen.getByTestId('tab-dashboard'));
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(screen.getByTestId('tab-dashboard').props.accessibilityState).toMatchObject({ selected: true });
});

test('the create button opens the sheet, and an action routes to its sheet', async () => {
  as(['admin']);
  await renderWithProviders(<AppTabBar {...props().props} />);
  await fireEvent.press(screen.getByTestId('create-button'));
  expect(mockPresent).toHaveBeenCalledTimes(1);

  expect(screen.getByTestId('create-action-add-student')).toBeTruthy();
  expect(screen.queryByTestId('create-action-start-lesson')).toBeNull();
  await fireEvent.press(screen.getByTestId('create-action-add-student'));
  expect(mockDismiss).toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith('/add-student');
});

test("a tutor's sheet: record, start and schedule; Start only with students of their own", async () => {
  as(['tutor']);
  await renderWithProviders(<AppTabBar {...props().props} />);
  expect(screen.getByTestId('create-action-start-lesson')).toBeTruthy();
  expect(screen.getByTestId('create-action-record-session')).toBeTruthy();
  expect(screen.getByTestId('create-action-schedule-lesson')).toBeTruthy();
  expect(screen.queryByTestId('create-action-add-student')).toBeNull();
  expect(screen.queryByTestId('create-action-record-payment')).toBeNull();
  // No money anywhere in the sheet.
  expect(screen.queryByText(/\$[0-9]/)).toBeNull();
});

test('a tutor who teaches nobody here is not offered Start', async () => {
  as(['tutor', 'parent']);
  mockPairings.mockReturnValue({ data: { data: [] } });
  await renderWithProviders(<AppTabBar {...props().props} />);
  expect(screen.queryByTestId('create-action-start-lesson')).toBeNull();
  expect(screen.getByTestId('create-action-record-session')).toBeTruthy();
});
