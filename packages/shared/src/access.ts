import { z } from 'zod';
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
export function accessPendingMessage(fullName?: string | null): string {
  const first = fullName?.trim().split(/\s+/)[0];
  return `${first ? `Thanks, ${first}. ` : ''}Your access is waiting for approval. You can sign in once it's approved.`;
}
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
}

/** What the console reads: the mode, the list, who waits and who was decided lately. */
export interface AccessConsoleResponse {
  settings: AccessSettings;
  list: AccessListEntry[];
  waiting: AccessAccount[];
  decided: AccessAccount[];
}

export const accessDecisionSchema = z.object({ access: z.enum(['approved', 'declined']) });
export type AccessDecision = z.infer<typeof accessDecisionSchema>;
