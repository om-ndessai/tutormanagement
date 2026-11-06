import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatInstant } from '@tmi/shared';

/**
 * Merge conditional class names, with later Tailwind utilities winning over
 * earlier conflicting ones. Used by every component in `components/ui`.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** The browser's own clock: for the platform console, which belongs to no space. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * An ISO-8601 timestamp as a person reads it, through the one shared formatter (Phase 78): "Nov 5, 4:05 PM", the
 * year only when it is not this year's. Pass the space's clock (`useOrgTimeZone()`) inside a space; the console
 * reads its own browser's.
 */
export function formatTimestamp(value: string | null, fallback: string, timeZone: string = browserTimeZone()) {
  if (!value) return fallback;
  return formatInstant(value, timeZone);
}
