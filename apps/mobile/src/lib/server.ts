import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { readPref, STORAGE_KEYS, writePref } from './storage';
import { APP_VARIANT } from './variant';

export { APP_VARIANT };

/**
 * Which Worker the app talks to.
 *
 * - local: `wrangler dev` on this Mac with the local seeded D1. The iOS simulator shares the
 *   Mac's localhost; the Android emulator reaches it through `adb reverse tcp:8787 tcp:8787`
 *   (run by the scripts), falling back to 10.0.2.2 if the reverse is missing.
 * - demo: the open feature demo (`tutoring-test`, TEST account). For browsing by hand only:
 *   tests never use it.
 * - custom: any URL, e.g. this Mac's LAN address for a real device (Phase 5).
 * - production: the `tutoring` Worker, never `tmi-portal` (which lands everyone in the
 *   institute). Only in the production variant, once Google sign-in exists (Phase 4).
 */
export type ServerKind = 'local' | 'demo' | 'custom' | 'production';

export const DEMO_URL = 'https://tutoring-test.tmi-api.workers.dev';
export const LOCAL_URL = 'http://localhost:8787';
export const ANDROID_HOST_URL = 'http://10.0.2.2:8787';

const PRODUCTION_URL = (Constants.expoConfig?.extra?.productionApiUrl as string | null) ?? null;

type ServerState = { kind: ServerKind; customUrl: string | null; devUser: string | null };

let state: ServerState = {
  kind: APP_VARIANT === 'production' ? 'production' : 'local',
  customUrl: null,
  devUser: null,
};

export function availableServers(): ServerKind[] {
  if (APP_VARIANT === 'production') return PRODUCTION_URL ? ['production'] : [];
  return ['local', 'demo', 'custom'];
}

/** The origin of the chosen Worker, without a trailing slash and without /api. */
export function serverOrigin(): string {
  switch (state.kind) {
    case 'local':
      return LOCAL_URL;
    case 'demo':
      return DEMO_URL;
    case 'custom':
      return (state.customUrl ?? LOCAL_URL).replace(/\/+$/, '');
    case 'production':
      return (PRODUCTION_URL ?? '').replace(/\/+$/, '');
  }
}

export function serverKind(): ServerKind {
  return state.kind;
}

export function customServerUrl(): string | null {
  return state.customUrl;
}

/** A local Worker is only reachable from the Android emulator through adb reverse or 10.0.2.2. */
export function androidFallbackOrigin(): string | null {
  return Platform.OS === 'android' && state.kind === 'local' ? ANDROID_HOST_URL : null;
}

/** The email the API acts as while sign-in is switched off there (X-Dev-User). */
export function devUser(): string | null {
  return APP_VARIANT === 'production' ? null : state.devUser;
}

export async function loadServerPrefs(): Promise<void> {
  if (APP_VARIANT === 'production') return;
  const [kind, customUrl, user] = await Promise.all([
    readPref(STORAGE_KEYS.server),
    readPref(STORAGE_KEYS.customServerUrl),
    readPref(STORAGE_KEYS.devUser),
  ]);
  state = {
    kind: kind === 'demo' || kind === 'custom' ? kind : 'local',
    customUrl,
    devUser: user,
  };
}

export async function setServer(kind: ServerKind, customUrl?: string | null): Promise<void> {
  state = { ...state, kind, customUrl: customUrl ?? state.customUrl };
  await Promise.all([
    writePref(STORAGE_KEYS.server, kind),
    writePref(STORAGE_KEYS.customServerUrl, state.customUrl),
  ]);
}

export async function setDevUser(email: string | null): Promise<void> {
  state = { ...state, devUser: email ? email.trim().toLowerCase() : null };
  await writePref(STORAGE_KEYS.devUser, state.devUser);
}
