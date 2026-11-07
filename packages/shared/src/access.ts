import { z } from 'zod';
import { PLATFORM_BRAND } from './brand.js';
import type { AgeBand } from './spaces.js';

// ---------------------------------------------------------------------------
// Sign-up access (Phase 65, docs/access-approval-plan.md, A1-A9)
// ---------------------------------------------------------------------------
// Who may sign up, chosen by platform admins in the console: anyone (open), only people on the
// platform's list (preapproved), or anyone, who then waits for a platform admin's approval
// (postapproved). Only people who sign up themselves are gated; people a space's admins add or invite
// get in through that space, and accounts made before this phase are approved.

export const ACCESS_MODES = ['open', 'preapproved', 'postapproved'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export const ACCESS_MODE_LABELS: Record<AccessMode, string> = {
  open: 'Open',
  preapproved: 'Pre-approved',
  postapproved: 'Post-approved',
};

export const ACCESS_MODE_DESCRIPTIONS: Record<AccessMode, string> = {
  open: 'Anyone may sign up.',
  preapproved: 'Only people on the list below may sign up.',
  postapproved: 'Anyone may sign up, then waits until a platform admin approves them.',
};

/** The console's setting (`platform_settings` 'access'). No row: open. */
export const accessSettingsSchema = z.object({ mode: z.enum(ACCESS_MODES) });
export type AccessSettings = z.infer<typeof accessSettingsSchema>;
export const DEFAULT_ACCESS_SETTINGS: AccessSettings = { mode: 'open' };

/** An account's access (`platform_accounts.access`). No platform account (added by a space): approved. */
export const ACCOUNT_ACCESS = ['approved', 'pending', 'declined'] as const;
export type AccountAccess = (typeof ACCOUNT_ACCESS)[number];

/** What the refusals are called, on the API and in both clients. */
export const ACCESS_ERROR_CODES = ['not_on_list', 'access_pending', 'access_declined'] as const;
export type AccessErrorCode = (typeof ACCESS_ERROR_CODES)[number];

export const NOT_ON_LIST_MESSAGE = 'Sign-up is by invitation for now. Ask us to add you.';
/**
 * What a self sign-up reads while it waits (Phase 65, A4), with the owner's promise of 2026-11-04 (UI audit
 * JF2): who checks, and how long it usually takes. No notice is sent when it ends (decided: words only), so
 * it says to sign in again.
 */
export function accessPendingMessage(fullName?: string | null): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return `${first ? `Thanks, ${first}. ` : ''}A person at ${PLATFORM_BRAND.name} checks every new account, usually within a day. Keep playing meanwhile, and sign in again tomorrow.`;
}

/**
 * What a sign-up says BEFORE the provider's button, by the platform's Sign-up access (UI audit JF2, JF8): a
 * newcomer learns of the wait or the list before the whole form, not after it (J02 step 9, J13).
 */
export const SIGNUP_ACCESS_NOTES: Partial<Record<AccessMode, string>> = {
  postapproved: `A person at ${PLATFORM_BRAND.name} checks every new account before you can sign in, usually within a day.`,
  preapproved: 'Sign-up is by invitation for now: only addresses on our list can join.',
};
export const ACCESS_DECLINED_MESSAGE = "Your access wasn't approved. Contact us if you think this is a mistake.";

/** One entry of the platform's list: an email, a pattern of one (`*`, `?`), or a provider account's id. */
export const accessListEntrySchema = z
  .object({
    email: z.string().trim().toLowerCase().min(3).max(254).nullable().optional(),
    provider: z.enum(['google', 'microsoft', 'apple', 'facebook']).nullable().optional(),
    subject: z.string().trim().min(1).max(200).nullable().optional(),
    note: z.string().trim().max(200).nullable().optional(),
  })
  .refine((entry) => Boolean(entry.email) || Boolean(entry.provider && entry.subject), {
    message: 'Give an email (or a pattern like *@school.org), or a provider and its account id.',
    path: ['email'],
  })
  .refine((entry) => !entry.email || /^[^\s@]+@[^\s@]+$/.test(entry.email), {
    message: 'That does not look like an email or a pattern of one.',
    path: ['email'],
  });
export type AccessListEntryInput = z.infer<typeof accessListEntrySchema>;

export interface AccessListEntry {
  id: string;
  email: string | null;
  provider: string | null;
  subject: string | null;
  note: string | null;
  added_at: string;
  added_by_name: string | null;
}

/** An account that signed up, as the console lists it for a decision. */
export interface AccessAccount {
  user_id: string;
  full_name: string;
  email: string | null;
  age_band: AgeBand;
  access: AccountAccess;
  /** The ways in it has ("google", ...). */
  providers: string[];
  signed_up_at: string;
  decided_at: string | null;
  decided_by_name: string | null;
  /**
   * Phase 80 (A11): where the approval placed them -- the space's name and how: joined at once (a console-made
   * space) or a request filed for its admins to answer (a self-started space). Absent when nowhere, and from older
   * Workers.
   */
  placed_in?: { name: string; how: PlacementHow } | null;
}

/** What the console reads: the mode, the list, who waits and who was decided lately. */
export interface AccessConsoleResponse {
  settings: AccessSettings;
  list: AccessListEntry[];
  waiting: AccessAccount[];
  decided: AccessAccount[];
}

// --- approved into a space (Phase 80, docs/members-plan.md A10-A15) -------------

/**
 * The role a placement gives: Member (no role, plays Quest) or Admin -- Admin only in a console-made space and never
 * for a 13-17. Anything else (a parent with their child, a tutor with rates) is the space's own admins' to give.
 */
export const PLACEMENT_ROLES = ['member', 'admin'] as const;
export type PlacementRole = (typeof PLACEMENT_ROLES)[number];

export const PLACEMENT_ROLE_LABELS: Record<PlacementRole, string> = { member: 'Member', admin: 'Admin' };

/** How a placement lands: joined at once (a console-made space) or a request its admins answer (a self-started one). */
export type PlacementHow = 'joined' | 'requested';

/**
 * PUT /api/platform/access/accounts/:userId. Phase 80 (A11): approving may name a space to place the person in.
 * Older consoles send `{ access }` alone, which keeps today's behaviour (approved with no place: their own space
 * is made, unless they already belong somewhere).
 */
export const accessDecisionSchema = z.object({
  access: z.enum(['approved', 'declined']),
  space: z
    .object({
      organization_id: z.uuid(),
      role: z.enum(PLACEMENT_ROLES).default('member'),
    })
    .optional(),
});
export type AccessDecision = z.input<typeof accessDecisionSchema>;

/** One space the approve sheet offers: live, not personal, with how it was made and what it may use. */
export interface PlacementSpace {
  id: string;
  name: string;
  short_name: string;
  /** 'console' joins the person at once; 'self_serve' files a request for its admins (Phase 80, owner 2026-11-06). */
  created_via: 'console' | 'self_serve';
  /** Whether Quest is on there: a member placed where it is off has nothing to do until given a role. */
  quest_on: boolean;
  tutoring_on: boolean;
  assessment_on: boolean;
}

/** What the approve sheet says will happen, in words, for a chosen space (both clients). */
export function placementWords(space: Pick<PlacementSpace, 'name' | 'created_via'>, firstName: string): string {
  return space.created_via === 'console'
    ? `${firstName} joins ${space.name} at once, and lands there when they sign in.`
    : `${space.name}'s admins are asked to let ${firstName} in. Until they answer, ${firstName} can make a space of their own.`;
}

/** The warning beside a space where Quest is off: a member there has nothing to do yet. */
export const PLACEMENT_QUEST_OFF = "Quest is off there, so a member has nothing to do until the space's admins give them a role.";
