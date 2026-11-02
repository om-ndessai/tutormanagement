import { z } from 'zod';
import {
  DEFAULT_GUEST_SETTINGS,
  DEFAULT_PLAY_SETTINGS,
  guestSettingsSchema,
  type GuestSettings,
  DEFAULT_TILES,
  EMPTY_SIGN_IN_SETTINGS,
  playSettingsSchema,
  questTileSchema,
  signInSettingsSchema,
  withCode,
  type PlaySettings,
  type QuestTile,
  type SignInSettings,
  type UpdatePlayInput,
} from '@tmi/shared';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Phase 62: the platform's own settings (`platform_settings`), one JSON value per key. No
 * organization: they are the platform's, set by platform admins in the console.
 *
 * `/api/auth/config` reads the sign-in setting on every visit, so each isolate keeps what it read
 * for a few seconds: a change made in the console reaches every visitor within SETTINGS_TTL_MS, and
 * the isolate that made it at once.
 */
const SETTINGS_TTL_MS = 15_000;

/**
 * Whether a memo read at `at` still serves a read at `now`. The console passes `now` 0 to read afresh:
 * a memo is never younger than zero, so that always misses (it used to hit forever, so the console
 * could show, and merge into, what another isolate had read long before).
 */
function memoServes(at: number, now: number): boolean {
  const age = now - at;
  return age >= 0 && age < SETTINGS_TTL_MS;
}

let signInMemo: { value: SignInSettings; at: number } | null = null;

/** For tests: forget what this isolate read. */
export function forgetPlatformSettings(): void {
  signInMemo = null;
}

/** The sign-in switches (P0). No row, or one that no longer parses: none, so the Worker's vars apply. */
export async function getSignInSettings(db: D1Database, now = Date.now()): Promise<SignInSettings> {
  if (signInMemo && memoServes(signInMemo.at, now)) return signInMemo.value;
  const row = await db
    .prepare("SELECT value FROM platform_settings WHERE key = 'sign_in'")
    .first<{ value: string }>();
  let value: SignInSettings = EMPTY_SIGN_IN_SETTINGS;
  if (row) {
    try {
      const parsed = signInSettingsSchema.safeParse(JSON.parse(row.value));
      if (parsed.success) value = parsed.data;
    } catch {
      // A value that no longer parses is treated as none: the defaults are always safe.
    }
  }
  signInMemo = { value, at: now };
  return value;
}

export async function putSignInSettings(db: D1Database, value: SignInSettings, actorId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_by) VALUES ('sign_in', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = ${NOW}`,
    )
    .bind(JSON.stringify(value), actorId)
    .run();
  signInMemo = { value, at: Date.now() };
}

/**
 * Phase 62 (P5): the tiles and the Play settings. No row: the defaults (DEFAULT_TILES,
 * DEFAULT_PLAY_SETTINGS). One value each, read through the same short memo.
 */
let playMemo: { value: { settings: PlaySettings; tiles: QuestTile[]; is_default: boolean }; at: number } | null = null;

export async function getPlay(
  db: D1Database,
  now = Date.now(),
): Promise<{ settings: PlaySettings; tiles: QuestTile[]; is_default: boolean }> {
  if (playMemo && memoServes(playMemo.at, now)) return playMemo.value;
  const rows = await db
    .prepare("SELECT key, value FROM platform_settings WHERE key IN ('play', 'tiles')")
    .all<{ key: string; value: string }>();
  const byKey = new Map((rows.results ?? []).map((row) => [row.key, row.value]));
  let settings = DEFAULT_PLAY_SETTINGS;
  let tiles = DEFAULT_TILES;
  let isDefault = true;
  try {
    const parsed = playSettingsSchema.safeParse(JSON.parse(byKey.get('play') ?? 'null'));
    if (parsed.success) settings = parsed.data;
  } catch {
    // The defaults stand.
  }
  try {
    const raw = byKey.get('tiles');
    if (raw) {
      const parsed = z.array(questTileSchema).safeParse(JSON.parse(raw));
      if (parsed.success) {
        tiles = parsed.data.map(withCode);
        isDefault = false;
      }
    }
  } catch {
    // The defaults stand.
  }
  const value = { settings, tiles, is_default: isDefault };
  playMemo = { value, at: now };
  return value;
}

export async function putPlay(db: D1Database, input: UpdatePlayInput, actorId: string): Promise<void> {
  const upsert = db.prepare(
    `INSERT INTO platform_settings (key, value, updated_by) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = ${NOW}`,
  );
  await db.batch([
    upsert.bind('play', JSON.stringify(input.settings), actorId),
    upsert.bind('tiles', JSON.stringify(input.tiles.map(({ kind, level_id, mode, value, guest, members }) => ({ kind, level_id, mode, value, guest, members }))), actorId),
  ]);
  playMemo = null;
}

/** Back to the default list (the settings are kept). */
export async function resetTiles(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM platform_settings WHERE key = 'tiles'").run();
  playMemo = null;
}

/** Phase 63 (P16): the guest settings. No row: DEFAULT_GUEST_SETTINGS (off). */
let guestMemo: { value: GuestSettings; at: number } | null = null;

export async function getGuestSettings(db: D1Database, now = Date.now()): Promise<GuestSettings> {
  if (guestMemo && memoServes(guestMemo.at, now)) return guestMemo.value;
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'guest'").first<{ value: string }>();
  let value = DEFAULT_GUEST_SETTINGS;
  if (row) {
    try {
      const parsed = guestSettingsSchema.safeParse(JSON.parse(row.value));
      if (parsed.success) value = parsed.data;
    } catch {
      // The defaults stand: off.
    }
  }
  guestMemo = { value, at: now };
  return value;
}

export async function putGuestSettings(db: D1Database, value: GuestSettings, actorId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_by) VALUES ('guest', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = ${NOW}`,
    )
    .bind(JSON.stringify(value), actorId)
    .run();
  guestMemo = { value, at: Date.now() };
}

