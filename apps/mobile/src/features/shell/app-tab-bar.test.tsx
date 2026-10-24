// The app's tab bar (UI upgrades U2, revised 2026-10-15): Home, Sessions, Progress and More for
// everyone, the create button in a hump between Sessions and Progress only for a reader with
// something to create, and its sheet listing that reader's own actions. Schedule is a route of the
// tabs but not a tab: it lights Sessions.
import { fireEvent, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { renderWithProviders } from '@/test/render';
import { AppTabBar, createSlot, visibleTabs } from './app-tab-bar';

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

const ALL_SETS = { canvas_assessments: true };
const ASSESS_ONLY = {
  feature_tutoring: false,
  feature_assessment: true,
  feature_quest: false,
  canvas_assessments: true,
  gamify_question_quest: false,
};

function as(roles: string[], organization: object = ALL_SETS) {
  mockAuth.mockReturnValue({ user: { id: 'me', roles }, organization });
}

beforeEach(() => {
  mockPush.mockClear();
  mockPresent.mockClear();
  mockDismiss.mockClear();
  mockPairings.mockReturnValue({ data: { data: [{ id: 'pairing' }] } });
});

/** The bar's slots, left to right (tree order), by testID. */
function slots(): string[] {
  return screen
    .getAllByTestId(/^(tab-(dashboard|sessions|schedule|progress|more)|create-button)$/)
    .map((node) => String(node.props.testID));
}

/** The bar's width, as its layout reports it: the hump is drawn from it. */
async function layOut(width = 390) {
  await fireEvent(screen.getByTestId('tab-bar'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height: 90 } },
  });
}

test('a parent: four tabs on a flat bar, no Schedule, no create button and no hump', async () => {
  as(['parent']);
  await renderWithProviders(<AppTabBar {...props().props} />);
  await layOut();
  expect(screen.queryByTestId('create-button')).toBeNull();
  expect(screen.queryByTestId('tab-bar-hump')).toBeNull();
  expect(slots()).toEqual(['tab-dashboard', 'tab-sessions', 'tab-progress', 'tab-more']);
  for (const label of ['Home', 'Sessions', 'Progress', 'More']) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.queryByText('Schedule')).toBeNull();
  expect(screen.queryByTestId('create-sheet')).toBeNull();
});

test('an admin: two tabs either side of the create button, in its hump', async () => {
  as(['admin']);
  await renderWithProviders(<AppTabBar {...props().props} />);
  await layOut();
  expect(screen.getByLabelText('Create')).toBeTruthy();
  expect(screen.getByTestId('create-button').props.accessibilityHint).toBe(
    'Record, start or schedule a lesson, and more',
  );
  expect(screen.getByTestId('tab-bar-hump')).toBeTruthy();
  expect(slots()).toEqual(['tab-dashboard', 'tab-sessions', 'create-button', 'tab-progress', 'tab-more']);
});

test('on Schedule, Sessions shows as chosen, and tapping it goes back to Lessons', async () => {
  as(['tutor']);
  const { navigation, props: barProps } = props(2);
  await renderWithProviders(<AppTabBar {...barProps} />);
  expect(screen.getByTestId('tab-sessions').props.accessibilityState).toMatchObject({ selected: true });
  expect(screen.getByTestId('tab-dashboard').props.accessibilityState).toMatchObject({ selected: false });
  await fireEvent.press(screen.getByTestId('tab-sessions'));
  expect(navigation.emit).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'tabPress', target: 'sessions-key' }),
  );
  expect(navigation.navigate).toHaveBeenCalledWith('sessions', undefined);
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

describe('Phase 50: the bar follows the feature sets', () => {
  test('four tabs with Tutoring, Home and More without it', () => {
    expect(visibleTabs(ALL_SETS)).toEqual(['dashboard', 'sessions', 'progress', 'more']);
    expect(visibleTabs(ASSESS_ONLY)).toEqual(['dashboard', 'more']);
  });

  test('the "+" stays in the middle', () => {
    expect(createSlot(4)).toBe(2);
    expect(createSlot(2)).toBe(1);
  });

  test("an Assessment-only admin's bar: Home, the +, More; the sheet offers Start an assessment", async () => {
    as(['admin'], ASSESS_ONLY);
    await renderWithProviders(<AppTabBar {...props().props} />);
    expect(slots()).toEqual(['tab-dashboard', 'create-button', 'tab-more']);
    expect(screen.queryByTestId('tab-sessions')).toBeNull();
    expect(screen.getByTestId('create-action-start-assessment')).toBeTruthy();
    expect(screen.getByTestId('create-action-add-student')).toBeTruthy();
    expect(screen.getByTestId('create-action-add-person')).toBeTruthy();
    expect(screen.queryByTestId('create-action-record-session')).toBeNull();
    expect(screen.queryByTestId('create-action-add-tutor')).toBeNull();
  });

  test('a parent there gets a flat bar of two', async () => {
    as(['parent'], ASSESS_ONLY);
    await renderWithProviders(<AppTabBar {...props().props} />);
    expect(slots()).toEqual(['tab-dashboard', 'tab-more']);
  });
});
