// Phase 80 (A11, A15, docs/members-plan.md; build-log entry 89): the pure parts of the console's approve sheet,
// ported from apps/web/src/features/platform/approve-sheet.tsx and access-section.tsx @ 758a19f (working tree):
// which roles a placement offers, the picker's rows and its note, what the sheet says, and the request it sends.
import {
  PLACEMENT_QUEST_OFF,
  PLACEMENT_ROLES,
  placementWords,
  type AccessAccount,
  type AccessDecision,
  type PlacementRole,
  type PlacementSpace,
} from '@tmi/shared';

/** The most spaces the picker lists at once; typing narrows it (the web's). */
export const PLACEMENT_SHOWN = 50;

/** The picker's first row, always listed and the default: approving with no place. */
export const NOWHERE_ID = 'nowhere';
export const NOWHERE_LABEL = 'Nowhere: they get a space of their own';

/** One line under each role (the web's words). */
export const PLACEMENT_ROLE_HINTS: Record<PlacementRole, string> = {
  member: 'Plays Quest there, with no role until its admins give one.',
  admin: 'Helps run the space: adds people, starts assessments.',
};

/** "Approve <name>", and the line under it: "<email> · Adult" / "Age 13-17". */
export function approveTitle(account: Pick<AccessAccount, 'full_name'>): string {
  return `Approve ${account.full_name}`;
}

export function approveDescription(account: Pick<AccessAccount, 'email' | 'age_band'>): string {
  const age = account.age_band === 'adult' ? 'Adult' : 'Age 13-17';
  return account.email ? `${account.email} · ${age}` : age;
}

/** The first word of their name, for the sentence. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

/**
 * The roles a placement offers: Member always; Admin only in a space made in the console, and never for a 13-17 (the
 * API refuses both anyway).
 */
export function placementRoles(
  space: Pick<PlacementSpace, 'created_via'> | null,
  ageBand: AccessAccount['age_band'],
): PlacementRole[] {
  return PLACEMENT_ROLES.filter((role) => role === 'member' || (space?.created_via === 'console' && ageBand !== '13-17'));
}

/** The role sent: the one chosen while it is offered, else Member. */
export function chosenPlacementRole(offered: readonly PlacementRole[], role: PlacementRole): PlacementRole {
  return offered.includes(role) ? role : 'member';
}

/** A space's line in the picker: how it takes them, and whether Quest is off there. */
export function placementLine(space: Pick<PlacementSpace, 'created_via' | 'quest_on'>): string {
  return `${space.created_via === 'console' ? 'Joins at once' : 'Its admins let them in'}${space.quest_on ? '' : ' · Quest off'}`;
}

/** The spaces whose name or short name holds the typed text (any case). */
export function matchingSpaces(spaces: readonly PlacementSpace[], query: string): PlacementSpace[] {
  const needle = query.trim().toLowerCase();
  return needle
    ? spaces.filter((space) => `${space.name} ${space.short_name}`.toLowerCase().includes(needle))
    : [...spaces];
}

/** What the sheet says when the chosen space is chosen: the sentence, and the warning where Quest is off. */
export function placementNotes(
  space: Pick<PlacementSpace, 'name' | 'created_via' | 'quest_on'>,
  fullName: string,
): { words: string; warning: string | null } {
  return {
    words: placementWords(space, firstNameOf(fullName)),
    warning: space.quest_on ? null : PLACEMENT_QUEST_OFF,
  };
}

/** The line under the picker, or null: loading, a failed read, nothing matching, or more than are shown. */
export function placementListNote(input: {
  pending: boolean;
  failed: boolean;
  query: string;
  matching: number;
  shown: number;
}): string | null {
  if (input.pending) return 'Loading spaces…';
  if (input.failed) return 'The spaces could not be loaded. Approving now gives them a space of their own.';
  if (input.matching === 0 && input.query.trim()) return 'No space has that name.';
  if (input.matching > input.shown) return `Showing ${input.shown} of ${input.matching}. Type to narrow.`;
  return null;
}

/** The PUT's body (with the account it is for): approved, with the place when one is chosen. */
export function approveRequest(
  account: Pick<AccessAccount, 'user_id'>,
  space: Pick<PlacementSpace, 'id'> | null,
  role: PlacementRole,
): { userId: string } & AccessDecision {
  return {
    userId: account.user_id,
    access: 'approved',
    ...(space ? { space: { organization_id: space.id, role } } : {}),
  };
}

/** Where an approval placed someone, on a decided row: "Joined <space>" / "Asked to join <space>". */
export function placedLine(placed: NonNullable<AccessAccount['placed_in']>): string {
  return placed.how === 'joined' ? `Joined ${placed.name}` : `Asked to join ${placed.name}`;
}
