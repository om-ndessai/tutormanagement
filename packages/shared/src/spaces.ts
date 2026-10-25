import { z } from 'zod';

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
  if (taken.some((t) => t.trim().toLowerCase() === plain)) return 'That name belongs to an organization on the platform.';
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
