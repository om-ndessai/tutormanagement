// Ported from apps/web/src/features/auth/signup-page.tsx @ 9485a8e (its pure parts)
import { PRIVACY_VERSION, TERMS_VERSION, type SignupInput } from '@tmi/shared';

/** The web's twelve names, in order: index + 1 is the month sent. */
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** This year back 100, newest first (the web's list). */
export function birthYears(now: Date): number[] {
  const thisYear = now.getFullYear();
  return Array.from({ length: 100 }, (_, i) => thisYear - i);
}

/** A newcomer between Google (or the developer sign-up) and the age question. Memory only. */
export interface PendingSignup {
  /** Google's signed claim (15 minutes); null on the developer path. */
  token: string | null;
  email: string;
  name: string;
  /** Sign-in off: `dev_email` / `dev_name` stand in for the token. */
  dev: boolean;
}

export interface SignupForm {
  birth_year: number;
  birth_month: number;
  /** The developer path only: the name typed on the screen. */
  dev_name?: string;
}

/** The exact body of POST /auth/signup: the current versions, and the token or the developer email. */
export function signupRequest(form: SignupForm, pending: PendingSignup): SignupInput {
  const body: SignupInput = {
    birth_year: form.birth_year,
    birth_month: form.birth_month,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
  };
  if (pending.token && !pending.dev) return { ...body, token: pending.token };
  const name = form.dev_name?.trim();
  return { ...body, dev_email: pending.email, ...(name ? { dev_name: name } : {}) };
}

/** "Sam Signup" -> "Sam"; an address alone -> its local part. */
export function firstNameOf(name: string): string {
  const plain = name.trim();
  if (plain.includes('@') && !plain.includes(' ')) return plain.split('@')[0] ?? plain;
  return plain.split(/\s+/)[0] ?? plain;
}

/** The terms and the privacy notice: pages on the portal's own address. */
export function legalUrl(kind: 'terms' | 'privacy', origin: string): string {
  return `${origin.replace(/\/+$/, '')}/${kind}`;
}
