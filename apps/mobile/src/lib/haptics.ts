import * as Haptics from 'expo-haptics';

import { readPref, STORAGE_KEYS, writePref } from './storage';

/**
 * Whether the app gives haptics at all: the Profile switch (ux-audit F-19; Apple asks for one).
 * On unless turned off on this device.
 */
let enabled = true;

export function hapticsEnabled(): boolean {
  return enabled;
}

/** Turns haptics on or off on this device, and remembers it. */
export function setHapticsEnabled(next: boolean): void {
  enabled = next;
  void writePref(STORAGE_KEYS.haptics, next ? null : 'off');
}

/** Reads the device's choice once, at start-up. */
export async function loadHapticsPreference(): Promise<void> {
  enabled = (await readPref(STORAGE_KEYS.haptics)) !== 'off';
}

const fire = (feedback: () => Promise<void>) => () => {
  if (!enabled) return;
  void feedback().catch(() => undefined);
};

/**
 * The app's one haptics vocabulary (docs/mobile/immersive-design.md, "Haptics"). Components
 * say what happened; this decides how it feels. Never ad-hoc Haptics calls elsewhere. A toast
 * gives its own success or error haptic, so a caller that shows one never adds another.
 */
export const haptics = {
  /** A choice changed: a tab, a segment, a toggle, a star. */
  selection: fire(() => Haptics.selectionAsync()),
  /** Something was saved or done: recorded, posted, sent. */
  success: fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** It did not work. */
  error: fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** About to do something that cannot be undone. */
  warning: fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** A light physical cue: a sheet snapping, a timer starting. */
  impact: fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
};
