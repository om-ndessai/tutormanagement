import { z } from 'zod';
import type { MailingAddressParts } from './profiles.js';

// ---------------------------------------------------------------------------
// Tax documents
// ---------------------------------------------------------------------------
// Phase 14. The institute files a tax document for each tutor at year end,
// which needs their SSN -- so the office has to know whose it already holds.
//
// The number itself is never stored, never transmitted through this portal,
// and never asked for by any screen in it. Everything here is about the
// RECEIPT of it: a date the office confirmed it had what it needs.

/**
 * Text that looks like a US Social Security number.
 *
 * Deliberately narrow. "123-45-6789" and "123 45 6789" are unmistakable, and
 * nine bare digits are only treated as one when the surrounding words say so
 * -- a nine-digit phone number, invoice reference or student id would
 * otherwise be rejected, and a validator that cries wolf gets worked around.
 */
const SSN_PATTERNS = [
  /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/,
  /\b(?:ssn|social security(?:\s+number)?|tax\s*id)\b[^0-9]{0,20}\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/i,
];

/** Whether this text appears to carry an SSN. */
export function containsSsn(value: string | null | undefined): boolean {
  if (!value) return false;
  return SSN_PATTERNS.some((pattern) => pattern.test(value));
}

export const SSN_REJECTED_MESSAGE =
  'This looks like a Social Security number. The portal never stores one — send it to the office directly, and they will confirm they have it.';

/**
 * Refuses text carrying an SSN.
 *
 * Applied to every field somebody could type one into -- notes, comments,
 * free-text profile fields -- because "we do not store SSNs" has to mean the
 * database cannot end up holding one by accident, not merely that no column
 * is named after it.
 */
export function refuseSsn<T extends z.ZodType<string>>(schema: T) {
  return schema.refine((value) => !containsSsn(value), { message: SSN_REJECTED_MESSAGE });
}

/** The date the office confirmed it holds a tutor's SSN. */
export const ssnReceiptSchema = z.object({
  /** True records today; false clears the confirmation. */
  received: z.boolean(),
});

export type SsnReceiptPayload = z.output<typeof ssnReceiptSchema>;

/** A tutor the office cannot file for yet. */
export interface TutorTaxStatus {
  user_id: string;
  full_name: string;
  /** NULL means the SSN has not been received; a tax document cannot be issued. */
  ssn_received_on: string | null;
  /** What this tutor has been paid in the tax year, for the year-end document. */
  paid_this_year_cents: number;
  /** The recipient's address for the 1099, from the tutor's profile. Admin-only. */
  address: MailingAddressParts;
}

/** Which calendar year the year-end summary covers. */
export const taxSummaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

/** The tax year a year-end document covers, given a date inside it. */
export function taxYearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}
