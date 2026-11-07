import { z } from 'zod';

import { PLATFORM_BRAND } from './brand.js';
import { featureAllowed, featureOn, type FeatureSet, type FeatureState } from './features.js';
import { ORG_TIME_ZONES, type OrgPalette } from './organizations.js';
import { ARRIVALS } from './home.js';
import { refuseSsn } from './tax.js';
import { optionalText, type UserRole } from './users.js';

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

/**
 * The role a person asks for when they ask to join (owner, 2026-11-04; UI audit JF26). The space's admins decide;
 * the Let in sheet starts on it. A teen asks only as a learner.
 */
export const JOIN_REQUEST_ROLES = ['parent', 'student', 'tutor', 'admin'] as const;
export type JoinRequestRole = (typeof JOIN_REQUEST_ROLES)[number];

export const JOIN_REQUEST_ROLE_LABELS: Record<JoinRequestRole, string> = {
  parent: 'A parent',
  student: 'A learner',
  tutor: 'A tutor',
  admin: 'Helping run it',
};

export const JOIN_REQUEST_ROLE_HINTS: Record<JoinRequestRole, string> = {
  parent: 'My child is, or will be, in this space.',
  student: 'I am here to practise.',
  tutor: 'I teach students here.',
  admin: 'I help run this space.',
};

/** The roles a person may ask for: a teen only a learner; a tutor only where the space has Tutoring. */
export function joinAskRolesFor(input: { teen: boolean; tutoring: boolean }): JoinRequestRole[] {
  if (input.teen) return ['student'];
  return JOIN_REQUEST_ROLES.filter((role) => role !== 'tutor' || input.tutoring);
}

/** A request's note, read by the space's admins only (R32). */
export const JOIN_NOTE_MAX = 200;

/** POST /api/spaces/join-requests: the code, and (Phase 72) the role asked for and a note. Older apps send the code. */
export const joinRequestSchema = spaceCodeSchema.extend({
  role: z.enum(JOIN_REQUEST_ROLES).optional(),
  note: optionalText(z.string().trim().max(JOIN_NOTE_MAX, `A note is at most ${JOIN_NOTE_MAX} characters.`)).optional(),
});
export type JoinRequestInput = z.input<typeof joinRequestSchema>;

/**
 * Phase 74 (JF31, owner 2026-11-05): the menu's people pages -- Users, Pairings, Billing -- are for admins and tutors.
 * A student or a parent never sees them (a parent reaches their child from the home's child card).
 */
export function seesPeoplePages(roles: readonly string[]): boolean {
  return roles.includes('admin') || roles.includes('tutor');
}

/**
 * Phase 79 (M6, docs/members-plan.md): the teaching pages -- Dashboard, Lessons, Progress, Schedule, Comments and
 * Assessment -- are for someone who holds a role here. A member (no role) plays Quest: their menu leaves them out,
 * though a link still opens them.
 */
export function seesTeachingPages(roles: readonly string[]): boolean {
  return roles.length > 0;
}

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
  /** Phase 68 (H4): how they arrived, one word from the guest device ('direct' when absent). Older apps omit it. */
  arrived_via: z.enum(ARRIVALS).optional(),
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
 * Whether a person may add people to the space they are reading (UI audit JF22): its admins, and not a 13-17
 * (Phase 63: a teen adds nobody). One rule for Users, People, the home and the app's (+), so the action is
 * offered only to those the API lets through.
 */
export function mayAddPeople(reader: { roles: readonly string[]; account: PlatformAccount | null }): boolean {
  return reader.roles.includes('admin') && reader.account?.age_band !== '13-17';
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
  /** Whether the space has Tutoring, so a person may ask to join as a tutor (Phase 72). Absent from older Workers. */
  offers_tutoring?: boolean;
}

/** One of the signed-in person's own open requests. */
export interface MyJoinRequest {
  slug: string;
  name: string;
  short_name: string;
  palette: OrgPalette;
  logo_mark_url: string | null;
  requested_at: string;
  /**
   * Null while open. An answer stays until the person dismisses it (owner, 2026-11-04; UI audit JF5): 'approved'
   * (they are in) and 'declined', for JOIN_OUTCOME_SHOWN_DAYS. Older clients read only null and 'declined'.
   */
  outcome: 'declined' | 'approved' | null;
  /** When the space answered (absent from older Workers, and null while open). */
  answered_at?: string | null;
}

/** How long a space's answer to a request stays on the person's home until dismissed (UI audit JF5). */
export const JOIN_OUTCOME_SHOWN_DAYS = 30;

/** A request as the space's admins see it: who Google says the person is. */
export interface JoinRequest {
  user_id: string;
  full_name: string;
  email: string | null;
  requested_at: string;
  /** What they asked to be, and their note (Phase 72, R32): null from an older app. Absent from older Workers. */
  role?: JoinRequestRole | null;
  note?: string | null;
  /**
   * Phase 79 (M5): the person signed up as a 13-17, so the Let in sheet offers no Admin (a teen is never an admin
   * of a shared space). Read by the space's admins only, beside the request (R32). Absent from older Workers.
   */
  teen?: boolean;
}

/**
 * Phase 79 (M5, docs/members-plan.md): the roles the Let in sheet offers, first to last. Member first -- in the
 * space with no role, playing Quest -- then Parent, Admin (never for a teen) and Tutor (only where Tutoring is on).
 * A student, who needs a parent here, is added with the full form.
 */
export const LET_IN_ROLES = ['member', 'parent', 'admin', 'tutor'] as const;
export type LetInRole = (typeof LET_IN_ROLES)[number];

export const LET_IN_ROLE_LABELS: Record<LetInRole, string> = {
  member: 'Member',
  parent: 'Parent',
  admin: 'Admin',
  tutor: 'Tutor',
};

/** One line under each Let in choice, on both clients. */
export const LET_IN_ROLE_HINTS: Record<LetInRole, string> = {
  member: 'Plays Quest here. Give them a role whenever you like.',
  parent: 'Their child is, or will be, in this space.',
  admin: 'Helps run the space: adds people, starts assessments.',
  tutor: 'Teaches students here.',
};

export function letInRolesFor(input: { teen: boolean; tutoring: boolean }): LetInRole[] {
  return LET_IN_ROLES.filter((role) => (role !== 'admin' || !input.teen) && (role !== 'tutor' || input.tutoring));
}

/**
 * Where the Let in sheet starts: the role asked for when it is offered (a parent, an admin, a tutor); otherwise --
 * a learner, or no role said -- Member, so letting someone in to play is one tap.
 */
export function letInStartRole(
  asked: JoinRequestRole | null | undefined,
  input: { teen: boolean; tutoring: boolean },
): LetInRole {
  const offered = letInRolesFor(input);
  return asked && asked !== 'student' && (offered as string[]).includes(asked) ? (asked as LetInRole) : 'member';
}

/** The roles a Let in choice sends: Member is none. */
export function letInRoles(role: LetInRole): UserRole[] {
  return role === 'member' ? [] : [role];
}

/**
 * Phase 80 (A12): POST /api/spaces/personal -- answer the offer of a space of one's own: make it, or no thanks. A
 * person who said no thanks may still make it later from Spaces or Welcome ("Make my own space").
 */
export const personalSpaceSchema = z.object({ make: z.boolean() });
export type PersonalSpaceInput = z.input<typeof personalSpaceSchema>;

/** POST /api/spaces/personal's answer: the space made (its slug and name), or the offer put away. */
export interface PersonalSpaceResult {
  made: boolean;
  slug: string | null;
  name: string | null;
}

/** Phase 79 (M5): the refusal when a 13-17 would become an admin of a shared space. */
export const TEEN_ADMIN_MESSAGE = 'Someone 13 to 17 cannot be an admin of a shared space.';

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
 * Phase 67 (H7): the curricula a personal space starts with, the first its default. NC 2026 carries the
 * guest page's "Grade 4" into the space (Phase 63's P13 promise); Beast Academy stays beside it.
 */
export const PERSONAL_SPACE_CURRICULA = ['nc-2026', 'ba'] as const;

/**
 * The roles the invite rows offer, in order, the first the default. Phase 79 (M3): Member first -- just the email,
 * no role; the space's admins give one later. Students are not here: they are added with "A family" or the full
 * form, which keep the guardian and consent rules (Phase 52).
 */
export const SPACE_INVITE_ROLES = ['member', 'admin', 'parent', 'tutor'] as const;
export type SpaceInviteRole = (typeof SPACE_INVITE_ROLES)[number];

export const SPACE_INVITE_ROLE_LABELS: Record<SpaceInviteRole, string> = {
  member: 'Member',
  admin: 'Admin',
  parent: 'Parent',
  tutor: 'Tutor',
};

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
  roles: UserRole[];
  status: 'invited';
} {
  return {
    email: row.email,
    full_name: row.full_name?.trim() ? row.full_name.trim() : nameFromEmail(row.email),
    // Phase 79 (M3): a member holds no role.
    roles: row.role === 'member' ? [] : [row.role],
    status: 'invited',
  };
}

/** Phase 76 (JF37): what each set makes a space for, in the order the invitation says it. */
const SPACE_WHAT: readonly [FeatureSet, string][] = [
  ['quest', 'practice'],
  ['assessment', 'assessments'],
  ['tutoring', 'lessons'],
];

/**
 * Phase 76 (JF37): what a space is for, from the sets that are on there, in words -- "practice and
 * assessments", "practice, assessments and lessons" ("lessons" only where Tutoring is on). Null
 * when none is on.
 */
export function spaceWhat(org: Partial<FeatureState> | null | undefined): string | null {
  const words = SPACE_WHAT.filter(([set]) => featureOn(org, set)).map(([, word]) => word);
  if (words.length === 0) return null;
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/**
 * The words "Copy invitation" and "Share" hand over: a self-serve space sends no email (Phase 51),
 * so the inviter tells them. Names only the inviter, the space, what the space is for (its sets,
 * Phase 76), the address and the invitee's own email -- never a code, a role or anything else
 * about the space. `address` is the link as given (both clients pass `<origin>/spaces`, where the
 * invitation waits). Without `org` (an older caller) the "a space for ..." clause is left out.
 *
 * "Ines invited you to Ferreira Family Practice on Aimtrue, a space for practice and assessments.
 * Open https://…/spaces and sign in with Google using ana@example.com: your invitation is waiting there."
 */
export function invitationText(input: {
  inviter: string;
  space: string;
  address: string;
  email: string;
  /** The space's feature state (its sets and switches), for what it is for. */
  org?: Partial<FeatureState> | null;
}): string {
  const what = input.org ? spaceWhat(input.org) : null;
  return (
    `${input.inviter} invited you to ${input.space} on ${PLATFORM_BRAND.name}` +
    `${what ? `, a space for ${what}` : ''}. ` +
    `Open ${input.address} and sign in with Google using ${input.email}: your invitation is waiting there.`
  );
}
