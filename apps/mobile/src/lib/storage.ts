import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferences kept on the device. Nothing sensitive: the server chosen, the theme, the last
 * organization (which only picks where a person lands -- the API checks membership on every
 * request), whether the tour was seen here, whether haptics are off, whether the notification permission was asked for (Android), whether dictation may use the phone's online speech service, which lesson reminders were dismissed (ids and dates only), which mastered topics Home has celebrated (ids only), which finished lessons the Now card has thrown confetti for (schedule ids and dates only), and the developer sign-in persona. Never a lesson,
 * a note, an amount or an SSN; and never the query cache.
 *
 * One exception, kept apart below (`canvasWork*`): an assessment's handwriting while it is being
 * taken (Phase 38), as the web keeps it in the browser, so leaving and coming back loses nothing. It
 * never reaches the server until it is submitted, and it is removed on submit and on discard.
 */
export const STORAGE_KEYS = {
  server: 'tmi.server',
  customServerUrl: 'tmi.server.custom',
  theme: 'tmi.theme',
  lastOrg: 'tmi.lastOrg',
  tourSeen: 'tmi.tourSeen',
  devUser: 'tmi.devUser',
  haptics: 'tmi.haptics',
  liveSurfaceAsked: 'tmi.liveSurfaceAsked',
  /** 'on' once the person agreed, on this phone, to dictate through its online speech service (P3). */
  dictationNetwork: 'tmi.dictationNetwork',
  /** The lesson reminders dismissed on this phone (Phase 33): `<schedule id>:<date>` keys, the last 50. */
  remindersDismissed: 'tmi.remindersDismissed',
  /** The mastered topics Home has celebrated on this phone (UI upgrades U6): `<student id>:<topic id>` keys, the last 200. */
  celebrated: 'tmi.celebrated',
  /** The finished lessons the tutor's Now card has celebrated here (Phase 43): `<schedule id>:<date>` keys, the last 200. */
  lessonsCelebrated: 'tmi.lessonsCelebrated',
} as const;

type Key = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export async function readPref(key: Key): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writePref(key: Key, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // A preference that cannot be saved is simply not remembered.
  }
}

/** Where an in-progress assessment's work is kept: one key per assessment (ids are unique everywhere). */
const CANVAS_WORK_PREFIX = 'tmi.canvasWork.';

export async function readCanvasWork(assessmentId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CANVAS_WORK_PREFIX + assessmentId);
  } catch {
    return null;
  }
}

export async function writeCanvasWork(assessmentId: string, value: string | null): Promise<void> {
  try {
    if (value === null) await AsyncStorage.removeItem(CANVAS_WORK_PREFIX + assessmentId);
    else await AsyncStorage.setItem(CANVAS_WORK_PREFIX + assessmentId, value);
  } catch {
    // Full storage: the work is still in memory until it is submitted.
  }
}
