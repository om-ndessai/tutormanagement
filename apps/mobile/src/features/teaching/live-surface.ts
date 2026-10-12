// The live lesson outside the app (ux-audit F-10; immersive-design.md §0.4, §10): an iOS Live
// Activity (Lock Screen, Dynamic Island) or an Android ongoing notification (a promoted Live Update
// on Android 16+). One facade, two drivers, driven by the same `['active-session']` query as the
// in-app banner, so the banner and the system surface can never disagree.
//
// The contract is non-negotiable: off the app the surface says EXACTLY "Lesson in progress" and a
// time the SYSTEM ticks from the server's start -- no student, tutor or organization name, no mode,
// notes, rate or amount, and no max-length countdown (the limit only stops the clock). That is why
// `LiveSurfaceContent` has no field that could carry anything else: the driver never sees the row.
//
// It ends on stop, discard and auto-stop (the query says nothing is running), on an organization
// switch and on sign-out (the host is keyed on the organization and unmounts), and whenever nobody
// is inside an organization (`endLiveSurface` from the root navigator, which also clears a surface
// left over from a run that was killed).
import type { ActiveSession } from '@tmi/shared';
import { useEffect } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';

import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';
import { liveSurfaceDriver } from './live-surface-driver';

/** The only words a running lesson may show outside the app. */
export const LIVE_SURFACE_TITLE = 'Lesson in progress';
/** Where a tap on the surface lands: the Sessions tab, where the live banner has Stop. */
export const LIVE_SURFACE_URL = 'tutorportal://sessions?tab=tutoring';
/** Android's Stop action opens the stop sheet; it never stops the lesson by itself. */
export const LIVE_SURFACE_STOP_URL = 'tutorportal://stop-lesson';

export type LiveSurfaceContent = {
  /** Which lesson: its start instant (a running lesson has no id). A new one starts a new surface. */
  key: string;
  title: typeof LIVE_SURFACE_TITLE;
  /** The server's start instant; the system counts up from it. */
  startedAtMs: number;
  /** The server's auto-stop instant: the clock stops (iOS) or the notification goes (Android). */
  endsAtMs: number | null;
};

/** What a platform implements. Every call is best-effort: a failure must never reach the UI. */
export type LiveSurfaceDriver = {
  show(content: LiveSurfaceContent, previous: LiveSurfaceContent | null): Promise<void>;
  end(): Promise<void>;
  isShowing(): Promise<boolean>;
};

function instant(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** The surface's whole content, from the reader's own running lesson (or nothing). */
export function liveSurfaceContent(
  mine: Pick<ActiveSession, 'started_at' | 'auto_stop_at'> | null | undefined,
): LiveSurfaceContent | null {
  if (!mine) return null;
  const startedAtMs = instant(mine.started_at);
  if (startedAtMs === null) return null;
  const endsAtMs = instant(mine.auto_stop_at);
  return {
    key: mine.started_at,
    title: LIVE_SURFACE_TITLE,
    startedAtMs,
    endsAtMs: endsAtMs !== null && endsAtMs > startedAtMs ? endsAtMs : null,
  };
}

export type LiveSurfacePlan = 'start' | 'update' | 'end' | 'none';

/** What to do going from what is shown to what should be. */
export function planLiveSurface(
  shown: LiveSurfaceContent | null,
  next: LiveSurfaceContent | null,
): LiveSurfacePlan {
  if (!next) return shown ? 'end' : 'none';
  if (!shown || shown.key !== next.key) return 'start';
  if (shown.startedAtMs !== next.startedAtMs || shown.endsAtMs !== next.endsAtMs) return 'update';
  return 'none';
}

export type LiveSurfaceController = {
  /** Brings the system surface in line with `next` (null: nothing running). */
  sync(next: LiveSurfaceContent | null): Promise<void>;
  /** Ends it, whatever this run believes is shown (a relaunch may have inherited one). */
  end(): Promise<void>;
  /** Re-applies the last wish, e.g. after the notification permission was granted. */
  refresh(): Promise<void>;
  isShowing(): Promise<boolean>;
};

/**
 * Serialises every call on one queue, so a fast start-then-stop cannot leave an orphan surface,
 * and remembers what it last showed so an unchanged poll does nothing.
 */
export function createLiveSurface(driver: LiveSurfaceDriver): LiveSurfaceController {
  let shown: LiveSurfaceContent | null = null;
  let wanted: LiveSurfaceContent | null = null;
  let queue: Promise<void> = Promise.resolve();
  // The system may hold a surface from an earlier run (killed, or relaunched after a stop on
  // another device): the first answer of this run is applied even when it is "nothing".
  let reconciled = false;

  function enqueue(task: () => Promise<void>): Promise<void> {
    queue = queue.then(task).catch(() => undefined);
    return queue;
  }

  async function apply(next: LiveSurfaceContent | null, force: boolean) {
    let plan = force && next ? 'start' : planLiveSurface(shown, next);
    if (!reconciled && plan === 'none' && !next) plan = 'end';
    reconciled = true;
    if (plan === 'none') return;
    if (plan === 'end') {
      shown = null;
      await driver.end();
      return;
    }
    const previous = shown;
    shown = next;
    await driver.show(next as LiveSurfaceContent, plan === 'update' ? previous : null);
  }

  return {
    sync(next) {
      wanted = next;
      return enqueue(() => apply(next, false));
    },
    end() {
      wanted = null;
      return enqueue(async () => {
        shown = null;
        reconciled = true;
        await driver.end();
      });
    },
    refresh() {
      return enqueue(() => apply(wanted, true));
    },
    isShowing() {
      return driver.isShowing().catch(() => false);
    },
  };
}

/** The app's one controller, on this platform's driver. */
export const liveSurface = createLiveSurface(liveSurfaceDriver);

/** Ends the surface outside an organization (signed out, the picker, a relaunch). */
export function endLiveSurface(): Promise<void> {
  return liveSurface.end();
}

/**
 * Mounted by `LiveSessionHost` (keyed on the organization): follows the reader's own running
 * lesson, and ends the surface when the host goes (organization switch, sign-out).
 */
export function useLiveSurface(mine: ActiveSession | null) {
  const startedAt = mine?.started_at ?? null;
  const autoStopAt = mine?.auto_stop_at ?? null;
  useEffect(() => {
    const content = startedAt
      ? liveSurfaceContent({ started_at: startedAt, auto_stop_at: autoStopAt ?? '' })
      : null;
    void liveSurface.sync(content);
  }, [startedAt, autoStopAt]);
  useEffect(() => () => void liveSurface.end(), []);
}

export const PERMISSION_RATIONALE = {
  title: 'Show the timer in your notifications?',
  message:
    'While a lesson runs, your notifications and lock screen show “Lesson in progress” and the time. Nothing else: no names.',
};

/**
 * Android 13+ needs POST_NOTIFICATIONS for the ongoing notification. Asked at the moment a lesson
 * starts (the Start sheet), never at launch; once per device, with a plain rationale first. iOS
 * needs no permission for a Live Activity (the person can turn them off in Settings).
 */
export async function askForLiveSurfacePermission(): Promise<void> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) return;
  const permission = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
  try {
    if (await PermissionsAndroid.check(permission)) return;
    if ((await readPref(STORAGE_KEYS.liveSurfaceAsked)) === 'yes') return;
    await writePref(STORAGE_KEYS.liveSurfaceAsked, 'yes');
    const proceed = await new Promise<boolean>((resolve) =>
      Alert.alert(PERMISSION_RATIONALE.title, PERMISSION_RATIONALE.message, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ]),
    );
    if (!proceed) return;
    const result = await PermissionsAndroid.request(permission);
    if (result === PermissionsAndroid.RESULTS.GRANTED) await liveSurface.refresh();
  } catch {
    // No permission, no notification; the in-app banner still shows the lesson.
  }
}
