import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ActiveSession } from '@tmi/shared';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

import {
  LIVE_SURFACE_TITLE,
  askForLiveSurfacePermission,
  createLiveSurface,
  liveSurfaceContent,
  planLiveSurface,
  type LiveSurfaceContent,
  type LiveSurfaceDriver,
} from './live-surface';

const STARTED = '2026-10-11T15:00:12.000Z';
const AUTO_STOP = '2026-10-11T17:00:12.000Z';

/** A running lesson as the server sends it to its tutor: names, notes and rates on the row. */
const mine: ActiveSession = {
  tutor_user_id: 't1',
  tutor_name: 'Alex Chen',
  student_user_id: 's1',
  student_name: 'Sofia Okafor',
  mode: 'virtual',
  started_at: STARTED,
  rounded_start: '2026-10-11T15:00:00.000Z',
  occurred_on: '2026-10-11',
  notes: 'Fractions, chapter 4',
  tutor_rate_cents: 4500,
  charge_rate_cents: 7000,
  max_minutes: 120,
  auto_stop_at: AUTO_STOP,
};

function fakeDriver() {
  const calls: string[] = [];
  const shown: LiveSurfaceContent[] = [];
  const driver: LiveSurfaceDriver = {
    show: jest.fn(async (content: LiveSurfaceContent, previous: LiveSurfaceContent | null) => {
      calls.push(previous ? 'update' : 'start');
      shown.push(content);
    }),
    end: jest.fn(async () => {
      calls.push('end');
    }),
    isShowing: jest.fn(async () => calls[calls.length - 1] !== 'end' && calls.length > 0),
  };
  return { driver, calls, shown };
}

describe('liveSurfaceContent', () => {
  it('is exactly the title and the server instants, whatever else the row carries', () => {
    const content = liveSurfaceContent(mine);
    expect(content).toEqual({
      key: STARTED,
      title: 'Lesson in progress',
      startedAtMs: Date.parse(STARTED),
      endsAtMs: Date.parse(AUTO_STOP),
    });
    // Nothing of the row's people, notes, mode or money can reach a system surface.
    const text = JSON.stringify(content);
    for (const leak of [
      'Sofia',
      'Okafor',
      'Alex',
      'Chen',
      'Fractions',
      'virtual',
      'Virtual',
      '4500',
      '7000',
      '$',
    ]) {
      expect(text).not.toContain(leak);
    }
    expect(LIVE_SURFACE_TITLE).toBe('Lesson in progress');
  });

  it('is nothing without a running lesson or a readable start', () => {
    expect(liveSurfaceContent(null)).toBeNull();
    expect(liveSurfaceContent(undefined)).toBeNull();
    expect(liveSurfaceContent({ started_at: 'not a date', auto_stop_at: AUTO_STOP })).toBeNull();
  });

  it('drops a limit that is not after the start', () => {
    expect(liveSurfaceContent({ started_at: STARTED, auto_stop_at: STARTED })?.endsAtMs).toBeNull();
    expect(liveSurfaceContent({ started_at: STARTED, auto_stop_at: '' })?.endsAtMs).toBeNull();
  });
});

describe('planLiveSurface', () => {
  const a = liveSurfaceContent(mine)!;
  const later = liveSurfaceContent({ ...mine, auto_stop_at: '2026-10-11T18:00:12.000Z' })!;
  const other = liveSurfaceContent({ ...mine, started_at: '2026-10-11T16:30:00.000Z' })!;

  it('starts, updates, ends or leaves it', () => {
    expect(planLiveSurface(null, a)).toBe('start');
    expect(planLiveSurface(a, a)).toBe('none');
    expect(planLiveSurface(a, later)).toBe('update');
    expect(planLiveSurface(a, other)).toBe('start');
    expect(planLiveSurface(a, null)).toBe('end');
    expect(planLiveSurface(null, null)).toBe('none');
  });
});

describe('createLiveSurface', () => {
  it('follows the query: start once, update on a new limit, end when nothing runs', async () => {
    const { driver, calls, shown } = fakeDriver();
    const surface = createLiveSurface(driver);
    const content = liveSurfaceContent(mine);
    await surface.sync(content);
    await surface.sync(content); // the 30 s poll, unchanged
    await surface.sync(liveSurfaceContent({ ...mine, auto_stop_at: '2026-10-11T18:00:12.000Z' }));
    await surface.sync(null); // stopped, discarded or auto-stopped
    await surface.sync(null);
    expect(calls).toEqual(['start', 'update', 'end']);
    expect(shown.every((item) => item.title === 'Lesson in progress')).toBe(true);
  });

  it('ends a surface inherited from an earlier run on its first answer', async () => {
    const { driver, calls } = fakeDriver();
    const surface = createLiveSurface(driver);
    await surface.sync(null);
    await surface.sync(null);
    expect(calls).toEqual(['end']);
  });

  it('ends on end() (sign-out, organization switch) and starts afresh after', async () => {
    const { driver, calls } = fakeDriver();
    const surface = createLiveSurface(driver);
    const content = liveSurfaceContent(mine);
    await surface.sync(content);
    await surface.end();
    await surface.sync(content);
    expect(calls).toEqual(['start', 'end', 'start']);
  });

  it('runs calls in order, so a quick start-then-stop leaves nothing behind', async () => {
    const { driver, calls } = fakeDriver();
    const surface = createLiveSurface(driver);
    void surface.sync(liveSurfaceContent(mine));
    void surface.sync(null);
    await surface.end();
    expect(calls).toEqual(['start', 'end', 'end']);
    expect(await surface.isShowing()).toBe(false);
  });

  it('re-applies the last wish on refresh (permission granted), and nothing when none', async () => {
    const { driver, calls } = fakeDriver();
    const surface = createLiveSurface(driver);
    await surface.sync(liveSurfaceContent(mine));
    await surface.refresh();
    expect(calls).toEqual(['start', 'start']);
    await surface.sync(null);
    await surface.refresh();
    expect(calls).toEqual(['start', 'start', 'end']);
  });

  it('never throws when the platform fails', async () => {
    const surface = createLiveSurface({
      show: async () => {
        throw new Error('Live Activities are off');
      },
      end: async () => {
        throw new Error('gone');
      },
      isShowing: async () => {
        throw new Error('gone');
      },
    });
    await expect(surface.sync(liveSurfaceContent(mine))).resolves.toBeUndefined();
    await expect(surface.end()).resolves.toBeUndefined();
    await expect(surface.isShowing()).resolves.toBe(false);
  });
});

describe('askForLiveSurfacePermission (Android)', () => {
  const original = { os: Platform.OS, version: Platform.Version };
  beforeEach(async () => {
    await AsyncStorage.clear();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: 36, configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: original.os, configurable: true });
    Object.defineProperty(Platform, 'Version', { value: original.version, configurable: true });
    jest.restoreAllMocks();
  });

  it('asks once, with the plain rationale first, never when already granted', async () => {
    const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Continue')?.onPress?.();
    });
    await askForLiveSurfacePermission();
    expect(alert).toHaveBeenCalledTimes(1);
    const [title, message] = alert.mock.calls[0]!;
    expect(title).toBe('Show the timer in your notifications?');
    expect(message).toContain('Lesson in progress');
    expect(message).toContain('no names');
    expect(request).toHaveBeenCalledTimes(1);

    await askForLiveSurfacePermission(); // the next lesson: not asked again
    expect(alert).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);

    await AsyncStorage.clear();
    check.mockResolvedValue(true);
    await askForLiveSurfacePermission(); // granted already: nothing to ask
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it('does not reach the system prompt when the rationale is declined', async () => {
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('granted');
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Not now')?.onPress?.();
    });
    await askForLiveSurfacePermission();
    expect(request).not.toHaveBeenCalled();
  });
});
