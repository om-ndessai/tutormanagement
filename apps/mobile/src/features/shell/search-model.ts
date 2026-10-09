// The matching and routing rules of apps/web/src/components/layout/command-palette.tsx @ 1132322,
// kept pure so they are tested without a screen.
import type { Href } from 'expo-router';
import type { User } from '@tmi/shared';

import type { ThemeMode } from '@/providers/theme-provider';

/**
 * True when every word typed appears in the row's value string, ignoring case -- so "money" finds
 * Billing through its keywords and "switch org" finds every "Switch to <organization>" action. An empty
 * query matches everything.
 */
export function matches(value: string, query: string): boolean {
  const haystack = value.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

/** The rows whose value string matches the query. */
export function filterRows<T extends { value: string }>(rows: T[], query: string): T[] {
  return rows.filter((row) => matches(row.value, query));
}

/** Where a person found by search opens: a student's progress for a non-admin, else their record. */
export function personHref(person: Pick<User, 'id' | 'roles'>, isAdmin: boolean): Href {
  return person.roles.includes('student') && !isAdmin
    ? { pathname: '/progress/[studentId]', params: { studentId: person.id } }
    : { pathname: '/people/[id]', params: { id: person.id } };
}

/** The web's three theme actions, with its labels and value strings. */
export const THEME_ACTIONS: { mode: ThemeMode; label: string; value: string; icon: string }[] = [
  {
    mode: 'light',
    label: 'Switch to light theme',
    value: 'switch to light theme mode appearance',
    icon: 'white-balance-sunny',
  },
  {
    mode: 'dark',
    label: 'Switch to dark theme',
    value: 'switch to dark theme mode appearance',
    icon: 'weather-night',
  },
  {
    mode: 'system',
    label: 'Match the system theme',
    value: 'match the system theme appearance',
    icon: 'theme-light-dark',
  },
];

/** People are searched on the server once there are this many characters to go on. */
export const PEOPLE_MIN_CHARS = 2;
