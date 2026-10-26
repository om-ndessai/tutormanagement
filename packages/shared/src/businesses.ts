import { z } from 'zod';

import { optionalText } from './users.js';

// ---------------------------------------------------------------------------
// Organizations in the money sense (Phase 54, docs/tutor-spaces-plan.md)
// ---------------------------------------------------------------------------
// On screen this is an "Organization": who families pay, and who files the
// 1099s, with its name, TIN and payer address. In the code a space is already
// `organizations`, so this record is a BUSINESS (`businesses`). Several spaces
// may share one. A space with none is PAID DIRECTLY: families pay each lesson's
// tutor, there is one price, and nobody takes a cut.

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

const state = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use the two-letter state code.');

/**
 * The payer box on every 1099 the organization issues. The TIN is NOT an SSN:
 * it runs through optionalText, so the SSN guard refuses one.
 */
export const businessPayerSchema = z.object({
  tin: optionalText(text(40, 'TIN')),
  payer_address_line1: optionalText(text(120, 'Address')),
  payer_address_line2: optionalText(text(120, 'Address')),
  payer_city: optionalText(text(80, 'City')),
  payer_state: optionalText(state),
  payer_postal_code: optionalText(
    text(10, 'ZIP code').regex(/^\d{5}(-\d{4})?$/, 'Use a 5-digit ZIP code.'),
  ),
});

export const createBusinessSchema = businessPayerSchema.extend({
  name: text(120, 'Name').min(1, 'Name is required.'),
});
export type CreateBusinessInput = z.input<typeof createBusinessSchema>;
export type CreateBusinessPayload = z.output<typeof createBusinessSchema>;

/** PATCH: every key optional, and an omitted one left alone (optionalText needs `.partial()`). */
export const updateBusinessSchema = createBusinessSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type UpdateBusinessInput = z.input<typeof updateBusinessSchema>;
export type UpdateBusinessPayload = z.output<typeof updateBusinessSchema>;

/** A space's organization: one to choose, or null for "Paid directly". */
/**
 * A business id. Not z.uuid(): a backfilled business takes its space's id
 * (docs/database.md, phase-54), and not every space id is a UUID.
 */
export const businessIdSchema = z.string().trim().min(1, 'Choose an organization.').max(64);

export const setSpaceBusinessSchema = z.object({
  business_id: businessIdSchema.nullable(),
});
export type SetSpaceBusinessPayload = z.output<typeof setSpaceBusinessSchema>;

export interface Business {
  id: string;
  name: string;
  tin: string | null;
  payer_address_line1: string | null;
  payer_address_line2: string | null;
  payer_city: string | null;
  payer_state: string | null;
  payer_postal_code: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A row on the console's Organizations list: the business and the spaces it runs. */
export interface BusinessListItem extends Business {
  spaces: { id: string; slug: string; name: string }[];
}

/** What a space's members are told about who runs its money: a name, never the TIN. */
export interface SpaceBusiness {
  id: string;
  name: string;
}

/** On screen, the paid-directly model in a few words. */
export const PAID_DIRECTLY_LABEL = 'Paid directly (no organization)';
