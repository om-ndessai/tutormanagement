// The app-switcher cover is on exactly while somebody is signed in, in the theme's colours, and
// goes off on sign-out (ux-audit F-1).
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/providers/theme-provider';

const mockEnable = jest.fn();
const mockDisable = jest.fn();
jest.mock('expo', () => ({
  requireOptionalNativeModule: () => ({ enable: mockEnable, disable: mockDisable }),
}));
jest.mock('expo-screen-capture', () => ({
  enableAppSwitcherProtectionAsync: jest.fn(() => Promise.resolve()),
  disableAppSwitcherProtectionAsync: jest.fn(() => Promise.resolve()),
}));

// Imported after the mocks, which it reads at load.
const { useAppSwitcherProtection } = require('./privacy-cover') as typeof import('./privacy-cover');

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
  mockEnable.mockClear();
  mockDisable.mockClear();
});

test('signed in: the cover is armed in the theme colours; signed out: disarmed', async () => {
  const hook = await renderHook(({ active }: { active: boolean }) => useAppSwitcherProtection(active), {
    initialProps: { active: true },
    wrapper,
  });
  expect(mockEnable).toHaveBeenCalledTimes(1);
  const [background, tint] = mockEnable.mock.calls[0] as [string, string];
  expect(background).toMatch(/^#[0-9A-F]{6}$/i);
  expect(tint).toMatch(/^#[0-9A-F]{6}$/i);
  expect(background).not.toBe(tint);

  await hook.rerender({ active: false });
  expect(mockDisable).toHaveBeenCalledTimes(1);
});

test('signed out from the start: never armed', async () => {
  await renderHook(() => useAppSwitcherProtection(false), { wrapper });
  expect(mockEnable).not.toHaveBeenCalled();
});
