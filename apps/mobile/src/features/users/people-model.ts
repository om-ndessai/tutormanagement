// The directory's and the record's pure rules, kept apart from the screens so they can be tested.
// `initials` and the sort fields from apps/web/src/features/users/{users-table,user-detail-view}.tsx
// @ 1132322.
import type { User, UserRole, UserSortField } from '@tmi/shared';

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
