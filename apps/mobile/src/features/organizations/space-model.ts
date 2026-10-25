// Phase 52: the pure parts of joining, making and sharing a space (entry 63), ported from
// apps/web/src/features/organizations/{welcome.tsx, space-code-card.tsx} @ 9485a8e.
import {
  createSpaceSchema,
  normalizeSpaceCode,
  ORG_TIME_ZONES,
  PLATFORM_BRAND,
  spaceNameProblem,
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

/** The person's requests: those waiting, and those just declined (shown once). */
export function splitRequests(requests: readonly MyJoinRequest[]): {
  open: MyJoinRequest[];
  declined: MyJoinRequest[];
} {
  return {
    open: requests.filter((r) => r.outcome === null),
    declined: requests.filter((r) => r.outcome === 'declined'),
  };
}

/** Only an adult may make a space; someone a space added has no band and is not asked. */
export function canMake(account: PlatformAccount | null): boolean {
  return !account || account.age_band === 'adult';
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
