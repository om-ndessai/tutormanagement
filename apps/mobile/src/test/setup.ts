// Jest setup: the native modules the app touches, replaced with their official mocks.
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Reanimated and its worklets runtime, with their official Jest mocks (no UI thread under Node).
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
// The official mock has no `useReducedMotion`; tests run as if motion were reduced.
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => true,
}));

// Gesture handler's own Jest setup: its native module and the detectors as plain views.
import 'react-native-gesture-handler/jestSetup';

// React Native's Jest environment reports a font scale of 2, past the 1.35 from which the layouts
// adapt (`use-large-text`). Tests run at the usual text size unless they set their own.
{
  const { Dimensions } = require('react-native') as typeof import('react-native');
  const window = Dimensions.get('window');
  const screen = Dimensions.get('screen');
  Dimensions.set({ window: { ...window, fontScale: 1 }, screen: { ...screen, fontScale: 1 } });
}
