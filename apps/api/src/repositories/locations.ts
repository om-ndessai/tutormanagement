import type { Location, LocationPayload, LocationUpdatePayload } from '@tmi/shared';

import type { OrgId } from '../lib/org.js';

// Phase 33: a person's places, a pairing's allowed set, a schedule's chosen ones. Every query
// names the organization; who may read or write which is decided in routes/locations.ts and in
// the routes that embed them (pairings, schedules), never here.

const SELECT_LOCATION = `
  SELECT l.id, l.owner_user_id, u.full_name AS owner_name, l.name, l.kind, l.address,
         l.reminder_minutes, l.created_at, l.updated_at
  FROM locations l
  JOIN users u ON u.id = l.owner_user_id
`;

export async function listOwnLocations(db: D1Database, org: OrgId, ownerId: string): Promise<Location[]> {
  const result = await db
    .prepare(`${SELECT_LOCATION} WHERE l.organization_id = ? AND l.owner_user_id = ? ORDER BY l.kind, l.name`)
    .bind(org, ownerId)
    .all<Location>();
  return result.results ?? [];
}

export async function getLocation(db: D1Database, org: OrgId, id: string): Promise<Location | null> {
  return db
    .prepare(`${SELECT_LOCATION} WHERE l.organization_id = ? AND l.id = ?`)
    .bind(org, id)
    .first<Location>();
}

/** Several locations of this organization by id; any from elsewhere are simply absent. */
export async function getLocations(db: D1Database, org: OrgId, ids: readonly string[]): Promise<Location[]> {
  if (ids.length === 0) return [];
  const result = await db
    .prepare(`${SELECT_LOCATION} WHERE l.organization_id = ? AND l.id IN (${ids.map(() => '?').join(', ')})`)
    .bind(org, ...ids)
    .all<Location>();
  return result.results ?? [];
}

export async function createLocation(db: D1Database, org: OrgId, input: LocationPayload): Promise<Location> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO locations (id, organization_id, owner_user_id, name, kind, address, reminder_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, org, input.owner_user_id, input.name, input.kind, input.address, input.reminder_minutes)
    .run();
  const created = await getLocation(db, org, id);
  if (!created) throw new Error('Insert into locations returned no row.');
  return created;
}

export async function updateLocation(
  db: D1Database,
  org: OrgId,
  id: string,
  input: LocationUpdatePayload,
): Promise<Location | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const field of ['name', 'kind', 'address', 'reminder_minutes'] as const) {
    if (field in input) {
      sets.push(`${field} = ?`);
      values.push(input[field]);
    }
  }
  if (sets.length > 0) {
    await db
      .prepare(`UPDATE locations SET ${sets.join(', ')} WHERE organization_id = ? AND id = ?`)
      .bind(...values, org, id)
      .run();
  }
  return getLocation(db, org, id);
}

export async function deleteLocation(db: D1Database, org: OrgId, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM locations WHERE organization_id = ? AND id = ?')
    .bind(org, id)
    .run();
  return Boolean(result.meta.changes);
}

/** How many schedules use a location: one that is used cannot be deleted. */
export async function schedulesUsingLocation(db: D1Database, org: OrgId, id: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM schedule_locations WHERE organization_id = ? AND location_id = ?')
    .bind(org, id)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Of these locations, the ones a schedule of this pairing uses: they cannot leave the pairing. */
export async function pairingLocationsInUse(
  db: D1Database,
  org: OrgId,
  assignmentId: string,
): Promise<Set<string>> {
  const result = await db
    .prepare(
      `SELECT DISTINCT sl.location_id AS id
       FROM schedule_locations sl
       JOIN scheduled_sessions ss ON ss.id = sl.schedule_id AND ss.organization_id = sl.organization_id
       JOIN assignments a ON a.organization_id = ss.organization_id
                         AND a.tutor_user_id = ss.tutor_user_id
                         AND a.student_user_id = ss.student_user_id
       WHERE sl.organization_id = ? AND a.id = ?`,
    )
    .bind(org, assignmentId)
    .all<{ id: string }>();
  return new Set((result.results ?? []).map((row) => row.id));
}

/** Each pairing's locations, for embedding in the pairings a reader can already see. */
export async function locationsForAssignments(
  db: D1Database,
  org: OrgId,
  assignmentIds: readonly string[],
): Promise<Map<string, Location[]>> {
  const map = new Map<string, Location[]>(assignmentIds.map((id) => [id, []]));
  if (assignmentIds.length === 0) return map;
  const result = await db
    .prepare(
      `SELECT al.assignment_id, l.id, l.owner_user_id, u.full_name AS owner_name, l.name, l.kind,
              l.address, l.reminder_minutes, l.created_at, l.updated_at
       FROM assignment_locations al
       JOIN locations l ON l.id = al.location_id AND l.organization_id = al.organization_id
       JOIN users u ON u.id = l.owner_user_id
       WHERE al.organization_id = ? AND al.assignment_id IN (${assignmentIds.map(() => '?').join(', ')})
       ORDER BY l.kind, l.name`,
    )
    .bind(org, ...assignmentIds)
    .all<Location & { assignment_id: string }>();
  for (const { assignment_id, ...location } of result.results ?? []) map.get(assignment_id)?.push(location);
  return map;
}

/** Each schedule's locations, for embedding in the schedules a reader can already see. */
export async function locationsForSchedules(
  db: D1Database,
  org: OrgId,
  scheduleIds: readonly string[],
): Promise<Map<string, Location[]>> {
  const map = new Map<string, Location[]>(scheduleIds.map((id) => [id, []]));
  if (scheduleIds.length === 0) return map;
  // D1 caps bound parameters per statement, so long lists are read in slices.
  for (let start = 0; start < scheduleIds.length; start += 80) {
    const slice = scheduleIds.slice(start, start + 80);
    const result = await db
      .prepare(
        `SELECT sl.schedule_id, l.id, l.owner_user_id, u.full_name AS owner_name, l.name, l.kind,
                l.address, l.reminder_minutes, l.created_at, l.updated_at
         FROM schedule_locations sl
         JOIN locations l ON l.id = sl.location_id AND l.organization_id = sl.organization_id
         JOIN users u ON u.id = l.owner_user_id
         WHERE sl.organization_id = ? AND sl.schedule_id IN (${slice.map(() => '?').join(', ')})
         ORDER BY l.kind, l.name`,
      )
      .bind(org, ...slice)
      .all<Location & { schedule_id: string }>();
    for (const { schedule_id, ...location } of result.results ?? []) map.get(schedule_id)?.push(location);
  }
  return map;
}

/** Replaces a pairing's whole set in one batch. */
export async function setAssignmentLocations(
  db: D1Database,
  org: OrgId,
  assignmentId: string,
  locationIds: readonly string[],
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM assignment_locations WHERE organization_id = ? AND assignment_id = ?').bind(org, assignmentId),
    ...locationIds.map((id) =>
      db
        .prepare('INSERT INTO assignment_locations (organization_id, assignment_id, location_id) VALUES (?, ?, ?)')
        .bind(org, assignmentId, id),
    ),
  ]);
}

/** A schedule's locations, as statements, so they go in the same batch as the schedule itself. */
export function scheduleLocationStatements(
  db: D1Database,
  org: OrgId,
  scheduleId: string,
  locations: readonly Pick<Location, 'id' | 'kind'>[],
): D1PreparedStatement[] {
  return [
    db.prepare('DELETE FROM schedule_locations WHERE organization_id = ? AND schedule_id = ?').bind(org, scheduleId),
    ...locations.map((location) =>
      db
        .prepare('INSERT INTO schedule_locations (organization_id, schedule_id, location_id, kind) VALUES (?, ?, ?, ?)')
        .bind(org, scheduleId, location.id, location.kind),
    ),
  ];
}
