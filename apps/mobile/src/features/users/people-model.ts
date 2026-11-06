// The directory's and the record's pure rules, kept apart from the screens so they can be tested.
// `initials` and the sort fields from apps/web/src/features/users/{users-table,user-detail-view}.tsx
// @ 1132322.
import {
  DAYS_OF_WEEK,
  formatTimeRange,
  parseClockTime,
  type Assignment,
  type ScheduledSession,
  type User,
  type UserDetail,
  type UserRole,
  type UserSortField,
} from '@tmi/shared';

/** "Sofia Okafor" -> "SO". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export interface SortChoice {
  sort: UserSortField;
  order: 'asc' | 'desc';
  label: string;
}

/**
 * The web sorts by tapping a column header; a phone has no header, so the same sortable columns
 * (`USER_SORT_FIELDS`) become a menu, each in the direction people mean by it.
 */
export const SORT_OPTIONS: SortChoice[] = [
  { sort: 'full_name', order: 'asc', label: 'Name A–Z' },
  { sort: 'full_name', order: 'desc', label: 'Name Z–A' },
  { sort: 'email', order: 'asc', label: 'Email' },
  { sort: 'status', order: 'asc', label: 'Status' },
  { sort: 'created_at', order: 'desc', label: 'Newest added' },
  { sort: 'created_at', order: 'asc', label: 'Oldest added' },
];

export function sortLabel(sort: UserSortField, order: 'asc' | 'desc'): string {
  return SORT_OPTIONS.find((option) => option.sort === sort && option.order === order)?.label ?? 'Sort';
}

interface Viewer {
  id: string;
  roles: readonly UserRole[];
}

/**
 * A tutor's rates are their pay, and their mailing address and SSN receipt are between them and
 * the office: the API sends them to an admin and to the tutor, and to nobody else. "Not set" would
 * be a false claim to a family, so for anyone else the rows are left out rather than shown empty.
 */
export function seesTutorPay(viewer: Viewer | null, personId: string): boolean {
  if (!viewer) return false;
  return viewer.roles.includes('admin') || viewer.id === personId;
}

/**
 * Whether the reader may deactivate, restore or delete this row: only an admin (the server's
 * `requireAdmin`), and never their own account (the server answers 409 to that).
 */
export function canActOn(viewer: Viewer | null, person: Pick<User, 'id'>): boolean {
  if (!viewer) return false;
  return viewer.roles.includes('admin') && viewer.id !== person.id;
}

/** "(919) 555-0155" -> "tel:9195550155"; a leading + survives. Null when there is no number. */
export function telUrl(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9+]/g, '');
  return digits.replace(/\D/g, '').length > 0 ? `tel:${digits}` : null;
}

/** An instant ("2026-10-09T04:45:55Z") on the organization's clock: "Oct 9, 2026, 12:45 AM". */
export function formatInstant(iso: string | null, timeZone: string, fallback: string): string {
  if (!iso) return fallback;
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone });
}

/** Whether the typed confirmation names the person: trimmed, case-insensitive. */
export function confirmsName(typed: string, fullName: string): boolean {
  return typed.trim().toLowerCase() === fullName.trim().toLowerCase() && typed.trim().length > 0;
}

/** A payment opened from a person's record (UI upgrades U5): who it is to or from comes with it. */
export interface PersonPaymentPrefill {
  key: 'tutor' | 'parent' | 'student';
  title: string;
  params: Record<string, string>;
}

/**
 * The payments a person's record can start, already filled: to a tutor; from a parent; and for a
 * student, from their primary guardian (or their only one) -- as a Billing row does.
 */
export function personPaymentPrefills(
  person: Pick<UserDetail, 'id' | 'roles' | 'guardians'>,
): PersonPaymentPrefill[] {
  const out: PersonPaymentPrefill[] = [];
  if (person.roles.includes('tutor')) {
    out.push({
      key: 'tutor',
      title: 'Record a payment to them',
      params: { direction: 'to_tutor', party: person.id },
    });
  }
  if (person.roles.includes('parent')) {
    out.push({
      key: 'parent',
      title: 'Record a payment from them',
      params: { direction: 'from_parent', party: person.id },
    });
  }
  if (person.roles.includes('student')) {
    const payer =
      person.guardians.find((guardian) => guardian.is_primary) ??
      (person.guardians.length === 1 ? person.guardians[0] : undefined);
    if (payer) {
      out.push({
        key: 'student',
        title: 'Record a payment for them',
        params: { direction: 'from_parent', party: payer.user_id, student: person.id },
      });
    }
  }
  return out;
}

// --- Phase 76 (JF21): the student's tutors and weekly lessons, on their record (Tutoring only, no money) ------

/** A student's tutors from their pairings: one row per tutor, active pairings only, by name. */
export function studentTutors(
  pairings: readonly Pick<Assignment, 'tutor_user_id' | 'tutor_name' | 'is_active'>[],
): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const pairing of pairings) {
    if (pairing.is_active && !seen.has(pairing.tutor_user_id)) seen.set(pairing.tutor_user_id, pairing.tutor_name);
  }
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * One weekly lesson in words: "Mondays, 4:00–5:00 PM with Alex Chen · Institute, room 2" -- the place for the
 * lesson's mode by NAME only (R16), never an address or a link.
 */
export function weeklyLessonLine(
  schedule: Pick<ScheduledSession, 'day_of_week' | 'start_time' | 'duration_minutes' | 'tutor_name' | 'mode' | 'locations'>,
): string {
  const day = DAYS_OF_WEEK[schedule.day_of_week]?.label ?? '';
  const start = parseClockTime(schedule.start_time) ?? 0;
  const kind = schedule.mode === 'virtual' ? 'virtual' : 'physical';
  const place = schedule.locations.find((location) => location.kind === kind) ?? schedule.locations[0];
  return `${day}s, ${formatTimeRange(start, start + schedule.duration_minutes)} with ${schedule.tutor_name}${
    place ? ` · ${place.name}` : ''
  }`;
}

/** The student's standing lessons that are on, in the week's order. */
export function studentWeeklyLessons<T extends Pick<ScheduledSession, 'is_active' | 'day_of_week' | 'start_time'>>(
  schedules: readonly T[],
): T[] {
  return schedules
    .filter((schedule) => schedule.is_active)
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
}
