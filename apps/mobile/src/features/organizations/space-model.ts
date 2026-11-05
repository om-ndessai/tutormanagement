// Phase 52: the pure parts of joining, making and sharing a space (entry 63), ported from
// apps/web/src/features/organizations/{welcome.tsx, space-code-card.tsx} @ 9485a8e.
import {
  createSpaceSchema,
  mayMakeSpace,
  normalizeSpaceCode,
  ORG_TIME_ZONES,
  PLATFORM_BRAND,
  spaceNameProblem,
  zonedClockParts,
  type MyJoinRequest,
  type OrgTimeZone,
  type PlatformAccount,
  type SpaceLookup,
} from '@tmi/shared';

/** Whether a typed code could be one (any case, with or without the dash or spaces). */
export function codeReady(text: string): boolean {
  return normalizeSpaceCode(text) !== null;
}

/** "FMXY-2345" read out one character at a time: "F M X Y, 2 3 4 5". */
export function spokenCode(code: string): string {
  return code
    .split('-')
    .map((part) => part.split('').join(' '))
    .join(', ');
}

/** The admin's invitation: the space's name, the code, and the portal's address (the web's words). */
export function shareText(name: string, code: string, origin?: string): string {
  const line = `Join ${name} on ${PLATFORM_BRAND.name} with the code ${code}.`;
  return origin ? `${line} ${origin}` : line;
}

/** The device's zone when the platform keeps lessons on it, else nothing (the server's default). */
export function deviceTimeZone(calendars: readonly { timeZone?: string | null }[]): OrgTimeZone | undefined {
  const zone = calendars[0]?.timeZone;
  return zone && (ORG_TIME_ZONES as readonly string[]).includes(zone) ? (zone as OrgTimeZone) : undefined;
}

/** Why a new space's name is refused before sending, or null (the server still decides a taken name). */
export function makeProblem(name: string): string | null {
  const parsed = createSpaceSchema.safeParse({ name });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Choose another name.';
  return spaceNameProblem(name);
}

/**
 * The person's requests: those waiting, and the spaces' answers -- let in or declined -- which stay until the
 * person dismisses them (owner, 2026-11-04; UI audit JF5).
 */
export function splitRequests(requests: readonly MyJoinRequest[]): {
  open: MyJoinRequest[];
  approved: MyJoinRequest[];
  declined: MyJoinRequest[];
} {
  return {
    open: requests.filter((r) => r.outcome === null),
    approved: requests.filter((r) => r.outcome === 'approved'),
    declined: requests.filter((r) => r.outcome === 'declined'),
  };
}

/** The answers not yet dismissed (let in or declined), in the session's order. */
export function answeredRequests(requests: readonly MyJoinRequest[]): MyJoinRequest[] {
  return requests.filter((r) => r.outcome === 'approved' || r.outcome === 'declined');
}

/** The account button's count (UI audit JF5): invitations waiting, plus answers not yet dismissed. */
export function accountBadgeCount(invitations: number, requests: readonly MyJoinRequest[]): number {
  return invitations + answeredRequests(requests).length;
}

/** The account sheet's row: "1 answer to your request", "2 answers to your requests". */
export function requestAnswersWaiting(count: number): string {
  return count === 1 ? '1 answer to your request' : `${count} answers to your requests`;
}

/** What a request's row says, by its standing (the same words on Home and on Spaces, and the web's). */
export function requestLine(request: Pick<MyJoinRequest, 'name' | 'outcome'>): string {
  if (request.outcome === 'approved') return `You're in ${request.name}.`;
  if (request.outcome === 'declined') return `${request.name} did not let you in.`;
  return `Asked to join ${request.name} · waiting for its admins.`;
}

/** "Declined on Nov 4, 2026." -- the day the space answered, on the reader's space's clock; null when unknown. */
export function declinedOnLine(answeredAt: string | null | undefined, timeZone: string): string | null {
  if (!answeredAt || Number.isNaN(Date.parse(answeredAt))) return null;
  const { day } = zonedClockParts(answeredAt, timeZone);
  const date = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
  return `Declined on ${date}.`;
}

/**
 * Only an adult may make a space (shared `mayMakeSpace`): someone a space added has no band, and
 * counts as an adult only while they hold a role other than student in one of their spaces.
 */
export function canMake(
  account: PlatformAccount | null,
  memberships: readonly { roles: readonly string[] }[] = [],
  platformAdmin = false,
): boolean {
  return mayMakeSpace({ account, memberships, platform_admin: platformAdmin });
}

/** What a found space says when the person may not ask (again). */
export function standingLine(standing: SpaceLookup['standing']): string | null {
  if (standing === 'member') return 'You already belong here.';
  if (standing === 'requested') return 'You have asked already.';
  return null;
}

/** The server's rule for confirming a delete: the name, trimmed, in any case. */
export function deleteNameMatches(typed: string, name: string): boolean {
  return typed.trim().length > 0 && typed.trim().toLowerCase() === name.trim().toLowerCase();
}

/** Only a self-serve space may be deleted from the app, and only by its admin. */
export function mayDeleteSpace(
  org: { created_via: string } | null,
  user: { roles: readonly string[] } | null,
): boolean {
  return org?.created_via === 'self_serve' && Boolean(user?.roles.includes('admin'));
}
