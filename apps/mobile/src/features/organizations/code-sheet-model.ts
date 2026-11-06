// Ported from apps/web/src/features/organizations/code-sheet.tsx @ 98c40ab (working tree): the pure parts of the one
// "Have a code?" sheet (UI audit JF4, JF9, JF26; owner 2026-11-04) -- what a request asks for, the sheet's words, and
// what a signed-out visit left on this phone for the first home -- so they are tested without a screen.
import {
  guestTileName,
  joinAskRolesFor,
  parseTileCode,
  type JoinRequestInput,
  type JoinRequestRole,
  type PlatformAccount,
  type SpaceLookup,
} from '@tmi/shared';

/** Under "Have a code?" (and the Quest board's box): the two kinds of code. */
export const CODE_SHEET_HINT = 'Six characters join a quest; eight ask to join a space.';

/** The roles a person may ask for here: a teen only a learner; a tutor only where the space has Tutoring. */
export function joinAskRoles(
  account: Pick<PlatformAccount, 'age_band'> | null | undefined,
  space: Pick<SpaceLookup, 'offers_tutoring'> | null | undefined,
): JoinRequestRole[] {
  return joinAskRolesFor({ teen: account?.age_band === '13-17', tutoring: space?.offers_tutoring === true });
}

/** The role a request carries: the one chosen while it is offered, else the first offered (a parent; a teen's learner). */
export function joinAskRole(chosen: JoinRequestRole | null, roles: readonly JoinRequestRole[]): JoinRequestRole {
  return chosen && roles.includes(chosen) ? chosen : (roles[0] ?? 'parent');
}

/** POST /spaces/join-requests: the code, the role and the note (an empty note is none). */
export function joinAskRequest(code: string, role: JoinRequestRole, note: string): JoinRequestInput {
  return { code, role, note: note.trim() || null };
}

/** The toast once asked: it names the space. */
export function askedToJoinText(name: string): string {
  return `Asked to join ${name}. Its admins will let you in.`;
}

/** The line under a found space's name. */
export function codeSheetStanding(space: Pick<SpaceLookup, 'name' | 'standing'>): string {
  if (space.standing === 'member') return `You already belong to ${space.name}.`;
  if (space.standing === 'requested') return `You have already asked to join ${space.name}.`;
  return 'Ask to join, and its admins let you in.';
}

/** Signed out: what keeping a code means. */
export function keptText(code: string): string {
  return `${code} will be waiting on your first screen once you have signed up or signed in. Nothing is sent until you use it.`;
}

/** What a signed-out visit left on this phone for the first home: a code typed, else a quest a friend sent. */
export type KeptOffer = { kind: 'code'; code: string } | { kind: 'sent'; code: string; name: string };

export function keptOffer(memory: { keptCode?: string; sentTile?: string }): KeptOffer | null {
  if (memory.keptCode) return { kind: 'code', code: memory.keptCode };
  const shape = memory.sentTile ? parseTileCode(memory.sentTile) : null;
  return shape && memory.sentTile ? { kind: 'sent', code: memory.sentTile, name: guestTileName(shape) } : null;
}

/** The guest page's line for a quest a friend sent that needs an account (JF9). */
export function sentQuestText(name: string): string {
  return `You were sent ${name}. It needs a free account; it will be waiting once you are in.`;
}
