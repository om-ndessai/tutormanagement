import { z } from 'zod';
import { optionalText } from './users.js';

// ---------------------------------------------------------------------------
// Locations (Phase 33)
// ---------------------------------------------------------------------------
// Where a person likes to have lessons. A location is owned by one tutor or
// student in one organization; a pairing allows some of its two people's
// locations; a schedule uses some of its pairing's: at least one, and never
// two of one kind. Who may read one is R16 (docs/data-exposure.md).

export const LOCATION_KINDS = ['physical', 'virtual'] as const;
export type LocationKind = (typeof LOCATION_KINDS)[number];

export const LOCATION_KIND_LABELS: Record<LocationKind, string> = {
  physical: 'In person',
  virtual: 'Online',
};

/** The longest reminder: a day ahead. */
export const MAX_REMINDER_MINUTES = 24 * 60;

export interface Location {
  id: string;
  owner_user_id: string;
  owner_name: string;
  name: string;
  kind: LocationKind;
  /** A street address for a physical place; a meeting link or joining instructions for a virtual one. */
  address: string | null;
  /** More than 0: remind people this many minutes before a lesson here. */
  reminder_minutes: number;
  created_at: string;
  updated_at: string;
}

const name = z.string().trim().min(1, 'Give the location a name.').max(80);
const address = optionalText(z.string().trim().max(500));
const reminderMinutes = z
  .number()
  .int('Use whole minutes.')
  .min(0, 'Use 0 for no reminder.')
  .max(MAX_REMINDER_MINUTES, 'A reminder can be at most a day ahead.');

export const locationInputSchema = z.object({
  owner_user_id: z.uuid(),
  name,
  kind: z.enum(LOCATION_KINDS),
  address,
  reminder_minutes: reminderMinutes.default(0),
});
export type LocationPayload = z.output<typeof locationInputSchema>;

/** No defaults: an omitted field stays as it is. The owner never changes. */
export const locationUpdateSchema = z
  .object({
    name: name.optional(),
    kind: z.enum(LOCATION_KINDS).optional(),
    address: address.optional(),
    reminder_minutes: reminderMinutes.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Provide at least one field to update.' });
export type LocationUpdatePayload = z.output<typeof locationUpdateSchema>;

export const listLocationsQuerySchema = z.object({
  /** One person's own locations. */
  user_id: z.uuid(),
});

/** The whole set of a pairing's allowed locations, replaced at once. */
export const assignmentLocationsSchema = z.object({
  location_ids: z.array(z.uuid()).max(20, 'Choose at most 20 locations.'),
});

/** A schedule's chosen locations: at least one (the kinds are checked against the locations). */
export const scheduleLocationIds = z
  .array(z.uuid())
  .min(1, 'Choose at least one location.')
  .max(2, 'Choose one in-person location, one online location, or one of each.');

/**
 * Why a set of locations cannot be a schedule's, or null when it can: at least one, and no
 * more than one of each kind. The API and both forms ask the same question.
 */
export function scheduleLocationProblem(locations: readonly Pick<Location, 'kind'>[]): string | null {
  if (locations.length === 0) return 'Choose at least one location.';
  for (const kind of LOCATION_KINDS) {
    if (locations.filter((location) => location.kind === kind).length > 1) {
      return `Choose only one ${LOCATION_KIND_LABELS[kind].toLowerCase()} location.`;
    }
  }
  return null;
}

/** "In person: Main library" */
export function describeLocation(location: Pick<Location, 'kind' | 'name'>): string {
  return `${LOCATION_KIND_LABELS[location.kind]}: ${location.name}`;
}

/**
 * The reminder lead for a lesson at these locations: the longest one set, or 0 for none.
 * A lesson with an in-person place and an online fallback reminds at the earlier of the two.
 */
export function reminderLeadMinutes(locations: readonly Pick<Location, 'reminder_minutes'>[]): number {
  return locations.reduce((lead, location) => Math.max(lead, location.reminder_minutes), 0);
}

/**
 * Whether a lesson starting `minutesUntilStart` from now is inside its reminder window: due,
 * and not yet started. Both clients use this to decide when to show the reminder sheet.
 */
export function isReminderDue(lead: number, minutesUntilStart: number): boolean {
  return lead > 0 && minutesUntilStart >= 0 && minutesUntilStart <= lead;
}
