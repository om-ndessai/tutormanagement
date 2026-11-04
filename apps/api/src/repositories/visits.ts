import {
  DEFAULT_VISIT_SETTINGS,
  STICKINESS_WEEKS,
  VISIT_KEEP_DAYS,
  addDays,
  computeStickiness,
  visitSettingsSchema,
  weekOf,
  type SpaceKind,
  type StickinessReport,
  type StickyArrival,
  type StickyHat,
  type StickyUnit,
  type VisitClient,
  type VisitSettings,
} from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/**
 * Phase 69 (docs/member-home-plan.md H12, R30): the days a person opens a space, and the daily rollup into
 * the console's Stickiness figures. Nothing here reads one person's days for anybody: the rollup counts,
 * and keeps totals over groups of STICKINESS_MIN_GROUP or more.
 */

// --- The console's switch (platform_settings 'visits'; no row: off) -----------------

const SETTINGS_TTL_MS = 15_000;
let settingsMemo: { value: VisitSettings; at: number } | null = null;

export async function getVisitSettings(db: D1Database, now = Date.now()): Promise<VisitSettings> {
  if (settingsMemo && now - settingsMemo.at >= 0 && now - settingsMemo.at < SETTINGS_TTL_MS) return settingsMemo.value;
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'visits'").first<{ value: string }>();
  let value = DEFAULT_VISIT_SETTINGS;
  if (row) {
    try {
      const parsed = visitSettingsSchema.safeParse(JSON.parse(row.value));
      if (parsed.success) value = parsed.data;
    } catch {
      // Off.
    }
  }
  settingsMemo = { value, at: now };
  return value;
}

export async function putVisitSettings(db: D1Database, value: VisitSettings, actorId: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_by) VALUES ('visits', ?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = ${NOW}`,
    )
    .bind(JSON.stringify(value), actorId)
    .run();
  settingsMemo = { value, at: Date.now() };
}

// --- Recording: at most once a day per person and space, per isolate ----------------

const recorded = new Set<string>();

/**
 * Called by requireOrg once a member is let in. Does nothing while recording is off; else one
 * INSERT OR IGNORE per person, space and day this isolate has not yet written.
 */
export async function recordVisit(db: D1Database, org: OrgId, userId: string, day: string, client: VisitClient): Promise<void> {
  const key = `${org}:${userId}:${day}`;
  if (recorded.has(key)) return;
  if (!(await getVisitSettings(db)).record) return;
  if (recorded.size > 10_000) recorded.clear();
  recorded.add(key);
  await db
    .prepare('INSERT OR IGNORE INTO visit_days (organization_id, user_id, day, client) VALUES (?, ?, ?, ?)')
    .bind(org, userId, day, client)
    .run();
}

/** For tests: forget what this isolate wrote and read. */
export function forgetVisits(): void {
  recorded.clear();
  settingsMemo = null;
}

// --- The rollup -------------------------------------------------------------------

/** The days a person came to a space, from both records: a visit, or a day played. */
const UNIT_DAYS = `
  SELECT organization_id, user_id, day FROM visit_days WHERE day >= ?1
  UNION
  SELECT organization_id, user_id, day FROM activity_days WHERE day >= ?1 AND (answers + game_answers + reviews) > 0`;

/** Reads every space's days for the window and counts them (org-scope: the platform's totals, R30). */
export async function computeStickinessNow(db: D1Database, today: string, recording: boolean): Promise<StickinessReport> {
  const since = addDays(weekOf(today), -7 * (STICKINESS_WEEKS + 1));
  const [days, dailies, roles, guardians, spaces, arrivals] = await db.batch([
    // org-scope: the platform's rollup reads every space, for totals only (R30).
    db.prepare(`WITH d AS (${UNIT_DAYS}) SELECT organization_id, user_id, group_concat(day) AS days FROM d GROUP BY organization_id, user_id`).bind(since),
    // org-scope: the platform's rollup reads every space, for totals only (R30).
    db
      .prepare('SELECT organization_id, user_id, group_concat(DISTINCT day) AS days FROM daily_results WHERE day >= ?1 GROUP BY organization_id, user_id')
      .bind(since),
    // org-scope: the platform's rollup reads every space, for totals only (R30).
    db
      .prepare(
        `WITH d AS (${UNIT_DAYS})
         SELECT r.organization_id, r.user_id, group_concat(r.role) AS roles FROM user_roles r
         WHERE EXISTS (SELECT 1 FROM d WHERE d.organization_id = r.organization_id AND d.user_id = r.user_id)
         GROUP BY r.organization_id, r.user_id`,
      )
      .bind(since),
    // org-scope: the platform's rollup reads every space, for totals only (R30).
    db
      .prepare(
        `WITH d AS (${UNIT_DAYS})
         SELECT DISTINCT g.organization_id, g.guardian_user_id AS user_id FROM guardianships g
         WHERE EXISTS (SELECT 1 FROM d WHERE d.organization_id = g.organization_id AND d.user_id = g.guardian_user_id)`,
      )
      .bind(since),
    // org-scope: the platform's rollup reads every space's kind.
    db.prepare('SELECT id, personal, feature_tutoring FROM organizations'),
    db
      .prepare(
        `WITH d AS (${UNIT_DAYS})
         SELECT a.user_id, a.arrived_via FROM platform_accounts a WHERE EXISTS (SELECT 1 FROM d WHERE d.user_id = a.user_id)`,
      )
      .bind(since),
  ]);

  const key = (org: string, user: string) => `${org}:${user}`;
  const dailyBy = new Map((dailies!.results as { organization_id: string; user_id: string; days: string }[]).map((r) => [key(r.organization_id, r.user_id), r.days.split(',')]));
  const rolesBy = new Map((roles!.results as { organization_id: string; user_id: string; roles: string }[]).map((r) => [key(r.organization_id, r.user_id), r.roles.split(',')]));
  const guardianSet = new Set((guardians!.results as { organization_id: string; user_id: string }[]).map((r) => key(r.organization_id, r.user_id)));
  const spaceBy = new Map(
    (spaces!.results as { id: string; personal: number; feature_tutoring: number | null }[]).map((r) => [
      r.id,
      (r.personal ? 'personal' : r.feature_tutoring === 0 ? 'practice' : 'tutoring') as SpaceKind,
    ]),
  );
  const arrivalBy = new Map((arrivals!.results as { user_id: string; arrived_via: string | null }[]).map((r) => [r.user_id, r.arrived_via]));

  const units: StickyUnit[] = (days!.results as { organization_id: string; user_id: string; days: string }[]).map((row) => {
    const k = key(row.organization_id, row.user_id);
    const kind = spaceBy.get(row.organization_id) ?? 'practice';
    const held = rolesBy.get(k) ?? [];
    const hat: StickyHat =
      held.includes('tutor') && kind === 'tutoring'
        ? 'tutor'
        : held.includes('admin') && kind !== 'personal'
          ? 'office'
          : held.includes('parent') || guardianSet.has(k)
            ? 'parent'
            : 'learner';
    const account = arrivalBy.has(row.user_id);
    const arrival: StickyArrival = !account ? 'invited' : ((arrivalBy.get(row.user_id) as StickyArrival | null) ?? 'unknown');
    return { user_id: row.user_id, hat, space_kind: kind, arrival, days: row.days.split(','), daily_days: dailyBy.get(k) ?? [] };
  });
  return computeStickiness(units, today, recording);
}

/** The figures as last computed, or null before the first rollup. */
export async function getStickiness(db: D1Database): Promise<StickinessReport | null> {
  const row = await db.prepare("SELECT value FROM platform_settings WHERE key = 'stickiness'").first<{ value: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.value) as StickinessReport;
  } catch {
    return null;
  }
}

/** Computes and stores the figures, and deletes visit rows past VISIT_KEEP_DAYS. */
export async function refreshStickiness(db: D1Database, today: string): Promise<StickinessReport> {
  const report = await computeStickinessNow(db, today, (await getVisitSettings(db, 0)).record);
  await db.batch([
    db
      .prepare(
        `INSERT INTO platform_settings (key, value, updated_by) VALUES ('stickiness', ?, NULL)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = ${NOW}`,
      )
      .bind(JSON.stringify(report)),
    // org-scope: the platform's retention rule, every space alike (R30).
    db.prepare('DELETE FROM visit_days WHERE day < ?').bind(addDays(today, -VISIT_KEEP_DAYS)),
  ]);
  return report;
}

/** Once a day, from the cron. */
export async function refreshStickinessIfDue(db: D1Database, today: string): Promise<boolean> {
  const row = await db.prepare("SELECT updated_at FROM platform_settings WHERE key = 'stickiness'").first<{ updated_at: string }>();
  if (row && Date.now() - Date.parse(row.updated_at) < 24 * 3_600_000) return false;
  await refreshStickiness(db, today);
  return true;
}
