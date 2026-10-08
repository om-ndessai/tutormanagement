import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Preferences kept on the device. Nothing sensitive: the server chosen, the theme, the last
 * organization (which only picks where a person lands -- the API checks membership on every
 * request), whether the tour was seen here, and the developer sign-in persona. Never a lesson,
 * a note, an amount or an SSN; and never the query cache.
 */
export const STORAGE_KEYS = {
  server: 'tmi.server',
  customServerUrl: 'tmi.server.custom',
  theme: 'tmi.theme',
  lastOrg: 'tmi.lastOrg',
  tourSeen: 'tmi.tourSeen',
  devUser: 'tmi.devUser',
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
