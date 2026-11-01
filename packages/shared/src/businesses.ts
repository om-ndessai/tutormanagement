import { z } from 'zod';

import { optionalText } from './users.js';

// ---------------------------------------------------------------------------
// A space's payer details (Phase 54, Phase 59: docs/spaces-plan.md, S2)
// ---------------------------------------------------------------------------
// On screen a space has a PAYMENT MODEL: "The space" collects families' payments,
// pays its tutors and files their 1099s, under its own payer details (the name on
// the 1099, the TIN, the address); or "Each tutor, directly", PAID DIRECTLY, where
// families pay each lesson's tutor, there is one price, and nobody takes a cut.
// Underneath, the payer details are a BUSINESS (`businesses`): one row per space,
// keyed by the space's id, and never shared by two spaces (decision 5). Phase 54's
// routes that name a business stay for app builds already on phones.

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

/**
 * A business id. Not z.uuid(): a backfilled business takes its space's id
 * (docs/database.md, phase-54), and not every space id is a UUID.
 */
export const businessIdSchema = z.string().trim().min(1, 'Choose who families pay.').max(64);

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

/** Phase 54's console list (kept for older app builds): the business and the spaces it runs. */
export interface BusinessListItem extends Business {
  spaces: { id: string; slug: string; name: string }[];
}

/** What a space's members are told about who collects its payments: a name, never the TIN. */
export interface SpaceBusiness {
  id: string;
  name: string;
}

/** On screen, the paid-directly model in a few words. */
export const PAID_DIRECTLY_LABEL = 'Families pay each tutor directly';

/** Phase 59: who families pay -- the space, or each lesson's tutor. */
export const SPACE_PAYMENT_MODELS = ['space', 'direct'] as const;
export type SpacePaymentModel = (typeof SPACE_PAYMENT_MODELS)[number];

export const SPACE_PAYMENT_MODEL_LABELS: Record<SpacePaymentModel, string> = {
  space: 'The space',
  direct: 'Each tutor, directly',
};

export const SPACE_PAYMENT_MODEL_DESCRIPTIONS: Record<SpacePaymentModel, string> = {
  space: 'The space collects payments, pays its tutors and files their 1099s.',
  direct: 'Families pay each tutor directly: one price per lesson, nobody’s cut, no 1099s from the space.',
};

/** The model a space is on, from what its members read. */
export function spacePaymentModel(org: { business: SpaceBusiness | null }): SpacePaymentModel {
  return org.business === null ? 'direct' : 'space';
}

/** `PUT /api/platform/organizations/:id/payment-model`: replaces choosing a business. */
export const spacePaymentModelSchema = z.object({
  model: z.enum(SPACE_PAYMENT_MODELS, { message: 'Choose who families pay.' }),
});
export type SpacePaymentModelInput = z.input<typeof spacePaymentModelSchema>;

/**
 * The payer details as they travel on the space (the console's create and PATCH):
 * the name on the 1099 (the space's own name when left blank) and the payer box.
 */
export const spacePayerSchema = businessPayerSchema.extend({
  payer_name: optionalText(text(120, 'Name on the 1099')),
});
export const SPACE_PAYER_FIELDS = [
  'payer_name',
  'tin',
  'payer_address_line1',
  'payer_address_line2',
  'payer_city',
  'payer_state',
  'payer_postal_code',
] as const;
export type SpacePayerField = (typeof SPACE_PAYER_FIELDS)[number];

/** A space's payer details, as the platform console reads them. Null while families pay each tutor. */
export interface SpacePayer {
  name: string;
  tin: string | null;
  payer_address_line1: string | null;
  payer_address_line2: string | null;
  payer_city: string | null;
  payer_state: string | null;
  payer_postal_code: string | null;
}
