import { z } from 'zod';

import { PLATFORM_BRAND } from './brand.js';
import { featureAllowed, type FeatureState } from './features.js';
import { ORG_TIME_ZONES, type OrgPalette } from './organizations.js';
import { refuseSsn } from './tax.js';

// ---------------------------------------------------------------------------
// Open sign-up and spaces (Phase 52, docs/open-signup-plan.md)
// ---------------------------------------------------------------------------
// A newcomer signs in with Google, says their age band (nothing is stored for
// an under-13), and then joins a space with its code -- by asking, and being let
// in by its admins -- or names a space of their own. "Space" is the word on
// screen; in the code it is still an organization.

/** A space code: 8 characters without look-alikes (no 0/O, 1/I/L, U). Shown as XXXX-XXXX. */
export const SPACE_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SPACE_CODE_LENGTH = 8;

/** A typed code in any case, with or without the dash or spaces; null when it cannot be one. */
export function normalizeSpaceCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== SPACE_CODE_LENGTH) return null;
  for (const ch of code) if (!SPACE_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** "K7QM9XDA" -> "K7QM-9XDA". */
export function formatSpaceCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** The slug of a self-serve space, made from its code: unique, and never from its name. */
export function spaceSlugFor(code: string): string {
  return `s-${code.toLowerCase()}`;
}

export const spaceCodeSchema = z.object({
  code: z
    .string()
    .max(20)
    .transform((value, ctx) => {
      const code = normalizeSpaceCode(value);
      if (!code) {
        ctx.addIssue({ code: 'custom', message: 'A space code is 8 letters and digits, like K7QM-9XDA.' });
        return z.NEVER;
      }
      return code;
    }),
});
export type SpaceCodeInput = z.input<typeof spaceCodeSchema>;

/** Words a self-serve space may not take in its name: it must never pass for the platform or an institute. */
export const RESERVED_SPACE_WORDS = ['aimtrue', 'official', 'institute', 'platform', 'admin', 'support'];

/** Why a space's name is refused, or null. `taken` are the names of the organizations the platform made. */
export function spaceNameProblem(name: string, taken: readonly string[] = []): string | null {
  const plain = name.trim().toLowerCase();
  const word = RESERVED_SPACE_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(plain));
  if (word) return `A space’s name cannot use the word “${word}”.`;
  if (taken.some((t) => t.trim().toLowerCase() === plain)) return 'That name belongs to another space on the platform.';
  return null;
}

export const createSpaceSchema = z.object({
  name: refuseSsn(z.string().trim().min(2, 'At least 2 characters.').max(80, 'At most 80 characters.')),
  time_zone: z.enum(ORG_TIME_ZONES).optional(),
});
export type CreateSpaceInput = z.input<typeof createSpaceSchema>;

// --- signing up -------------------------------------------------------------

export const AGE_BANDS = ['13-17', 'adult'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/** The band a birth month and year fall in on `today`; 'under13' is never stored. */
export function ageBandFor(year: number, month: number, today: Date): AgeBand | 'under13' {
  const months = (today.getUTCFullYear() - year) * 12 + (today.getUTCMonth() + 1 - month);
  const years = Math.floor(months / 12);
  if (years < 13) return 'under13';
  if (years < 18) return '13-17';
  return 'adult';
}

export const signupSchema = z.object({
  /** From POST /api/auth/google's `signup` answer: who Google says they are, signed, for 15 minutes. */
  token: z.string().max(4096).optional(),
  /** Sign-in off only (local and the demo): who to sign up, in place of a token. */
  dev_email: z.email().max(254).optional(),
  dev_name: z.string().trim().max(120).optional(),
  // A fixed bound: a Worker's clock reads 1970 while a module loads, so no date is taken here.
  birth_year: z.number().int().min(1900).max(2100),
  birth_month: z.number().int().min(1).max(12),
  terms_version: z.string().min(1).max(40),
  privacy_version: z.string().min(1).max(40),
});
export type SignupInput = z.input<typeof signupSchema>;

/** The answer to a Google sign-in for an account the platform does not know (a client that asked for it). */
export interface SignupStart {
  signup: { token: string; email: string; name: string };
}

/** A self-registered person's standing on the platform. */
export interface PlatformAccount {
  age_band: AgeBand;
}

/**
 * Whether a person may start a space (adults only, S11). A self-registered person's age band
 * decides. Someone a space added gave no age: a space vouches for an adult only by giving them a
 * role a child does not hold there (admin, tutor, parent), and only while they belong to it -- a
 * student alone, or someone in no space, is not known to be an adult. Platform admins may.
 * The API and both clients call it, so the form and the refusal agree.
 */
export function mayMakeSpace(standing: {
  account: PlatformAccount | null;
  memberships: readonly { roles: readonly string[] }[];
  platform_admin?: boolean;
}): boolean {
  if (standing.account) return standing.account.age_band === 'adult';
  if (standing.platform_admin) return true;
  return standing.memberships.some((m) => m.roles.some((role) => role !== 'student'));
}

// --- joining ------------------------------------------------------------------

/** What a code shows before asking to join: the space's face, never its people. */
export interface SpaceLookup {
  name: string;
  short_name: string;
  palette: OrgPalette;
  logo_mark_url: string | null;
  /** Whether the person already belongs, or already asked. */
  standing: 'member' | 'requested' | null;
}

/** One of the signed-in person's own open requests. */
export interface MyJoinRequest {
  slug: string;
  name: string;
  short_name: string;
  palette: OrgPalette;
  logo_mark_url: string | null;
  requested_at: string;
  /** Null while open; 'declined' is shown once so the person knows. */
  outcome: 'declined' | null;
}

/** A request as the space's admins see it: who Google says the person is. */
export interface JoinRequest {
  user_id: string;
  full_name: string;
  email: string | null;
  requested_at: string;
}

/** The space's code, for its admins. */
export interface SpaceCode {
  /** Formatted, "K7QM-9XDA"; null until one is made. */
  code: string | null;
  join_by_code: boolean;
}

/** Deleting a space: its admin types its name to confirm. */
export const deleteSpaceSchema = z.object({ confirm_name: z.string().trim().min(1).max(120) });
export type DeleteSpaceInput = z.input<typeof deleteSpaceSchema>;

/**
 * Phase 60 (S4, docs/spaces-plan.md): where a tab or the app ARRIVING with no space of its own
 * lands, from the person's own session. In order:
 * 1. a link naming a space (`?org=`, a calendar or share link), if they may enter it;
 * 2. the last space they chose (`is_default`, kept on the server, so every device agrees), if they
 *    may still enter it;
 * 3. exactly one space they may enter, and nothing pending (no invitation, no OPEN request to join:
 *    a declined one, shown until seen, has been answered);
 * 4. otherwise null: the selector ("Choose a space", or Welcome with nowhere to go).
 * Both clients call it, so the web and the app land alike.
 */
export function decideLanding(
  session: {
    memberships: readonly { slug: string; status: 'active' | 'suspended'; is_default: boolean }[];
    invitations: readonly unknown[];
    join_requests?: readonly { outcome?: string | null }[] | null;
  },
  linked?: string | null,
): string | null {
  const active = session.memberships.filter((m) => m.status === 'active');
  if (linked) {
    const named = active.find((m) => m.slug === linked.trim().toLowerCase());
    if (named) return named.slug;
  }
  const last = active.find((m) => m.is_default);
  if (last) return last.slug;
  // A declined request (kept until seen) has been answered: only an open one is pending.
  const open = (session.join_requests ?? []).filter((r) => r.outcome == null).length;
  const pending = session.invitations.length + open;
  if (active.length === 1 && pending === 0) return active[0]!.slug;
  return null;
}

// --- inviting people, after starting a space (Phase 61, S12) ------------------

/**
 * The roles the "Invite people" step offers, in order. Students are not here: they are added in
 * the welcome wizard's "Add a student", which keeps the guardian and consent rules (Phase 52).
 */
export const SPACE_INVITE_ROLES = ['admin', 'parent', 'tutor'] as const;
export type SpaceInviteRole = (typeof SPACE_INVITE_ROLES)[number];

/** The roles a space's invite rows may offer: Tutor only where Tutoring is allowed (never a newcomer's). */
export function inviteRolesFor(org: Partial<FeatureState> | null | undefined): SpaceInviteRole[] {
  return SPACE_INVITE_ROLES.filter((role) => role !== 'tutor' || featureAllowed(org, 'tutoring'));
}

/** One row of the step: an email and a role, and the name to show until they accept (optional). */
export const spaceInviteRowSchema = z.object({
  // Trimmed BEFORE the format check: z.email() checks the raw text, so a chained .trim() came too
  // late and refused an address pasted with a space around it.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Enter a valid email address.' }).max(254)),
  full_name: refuseSsn(z.string().trim().max(120, 'Name must be 120 characters or fewer.')).optional(),
  role: z.enum(SPACE_INVITE_ROLES),
});
export type SpaceInviteRowInput = z.input<typeof spaceInviteRowSchema>;
export type SpaceInviteRow = z.output<typeof spaceInviteRowSchema>;

/** "maria.lopez@example.com" -> "Maria Lopez": the name a row without one is sent with. */
export function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  const words = local.split(/[._+-]+/).filter(Boolean);
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return name || email;
}

/**
 * The ordinary add-person request (`POST /api/users`) a row becomes. The person is INVITED: an
 * existing account gets an invitation it accepts (S6), and a new email makes the person, invited,
 * who signs in later and finds it waiting -- a self-serve space's invitation is never accepted for
 * them (Phase 51). Both clients send exactly this.
 */
export function inviteRowRequest(row: SpaceInviteRow): {
  email: string;
  full_name: string;
  roles: [SpaceInviteRole];
  status: 'invited';
} {
  return {
    email: row.email,
    full_name: row.full_name?.trim() ? row.full_name.trim() : nameFromEmail(row.email),
    roles: [row.role],
    status: 'invited',
  };
}

/**
 * The words "Copy invitation" and "Share" hand over: a self-serve space sends no email (Phase 51),
 * so the inviter tells them. Names only the inviter, the space, the address and the invitee's own
 * email -- never a code, a role or anything else about the space.
 */
export function invitationText(input: { inviter: string; space: string; address: string; email: string }): string {
  return `${input.inviter} invited you to ${input.space} on ${PLATFORM_BRAND.name}. Sign in at ${input.address} with ${input.email}.`;
}
