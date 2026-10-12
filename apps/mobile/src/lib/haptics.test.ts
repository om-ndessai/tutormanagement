// The Haptics switch silences every haptic the app gives, and is remembered (ux-audit F-19).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { haptics, hapticsEnabled, loadHapticsPreference, setHapticsEnabled } from './haptics';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

const fireAll = () => Object.values(haptics).forEach((feedback) => feedback());
const calls = () =>
  (Haptics.selectionAsync as jest.Mock).mock.calls.length +
  (Haptics.notificationAsync as jest.Mock).mock.calls.length +
  (Haptics.impactAsync as jest.Mock).mock.calls.length;

beforeEach(() => jest.clearAllMocks());

test('on by default: every kind fires', () => {
  setHapticsEnabled(true);
  fireAll();
  expect(calls()).toBe(Object.keys(haptics).length);
});

test('off: nothing fires, and the choice survives a restart', async () => {
  setHapticsEnabled(false);
  fireAll();
  expect(calls()).toBe(0);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await AsyncStorage.getItem('tmi.haptics')).toBe('off');

  setHapticsEnabled(true); // as a fresh start would be, before the choice is read
  await AsyncStorage.setItem('tmi.haptics', 'off');
  await loadHapticsPreference();
  expect(hapticsEnabled()).toBe(false);
  fireAll();
  expect(calls()).toBe(0);
});
