// The console's organization form (a business, Phase 54), from
// apps/web/src/features/platform/businesses-page.tsx @ 24066d9 (working tree): FIELDS, EMPTY and the
// row's line. Validated with the shared schemas, as the server will; the TIN runs through
// optionalText, so an SSN-shaped one is refused before any request.
import {
  createBusinessSchema,
  updateBusinessSchema,
  type BusinessListItem,
  type CreateBusinessInput,
} from '@tmi/shared';

import { firstErrors } from './form-errors';

export const BUSINESS_FIELDS = [
  ['name', 'Name'],
  ['tin', 'TIN (EIN)'],
  ['payer_address_line1', 'Address'],
  ['payer_address_line2', 'Address line 2'],
  ['payer_city', 'City'],
  ['payer_state', 'State'],
  ['payer_postal_code', 'ZIP'],
] as const;

export type BusinessField = (typeof BUSINESS_FIELDS)[number][0];
export type BusinessForm = Record<BusinessField, string>;

export const EMPTY_BUSINESS_FORM: BusinessForm = Object.fromEntries(
  BUSINESS_FIELDS.map(([key]) => [key, '']),
) as BusinessForm;

export function formFromBusiness(business: BusinessListItem | null): BusinessForm {
  if (!business) return EMPTY_BUSINESS_FORM;
  return Object.fromEntries(BUSINESS_FIELDS.map(([key]) => [key, business[key] ?? ''])) as BusinessForm;
}

/** The shared schema's verdict: the body to send (the whole form, as the web sends it), or the errors. */
export function validateBusinessForm(
  form: BusinessForm,
  creating: boolean,
): { ok: true; input: CreateBusinessInput } | { ok: false; errors: Record<string, string> } {
  const result = (creating ? createBusinessSchema : updateBusinessSchema).safeParse(form);
  if (result.success) return { ok: true, input: form };
  return { ok: false, errors: firstErrors(result.error.issues) };
}

/** "TIN on file · runs <its spaces>" / "No TIN yet · runs no space". */
export function businessSummary(row: Pick<BusinessListItem, 'tin' | 'spaces'>): string {
  return (
    `${row.tin ? 'TIN on file' : 'No TIN yet'} · ` +
    (row.spaces.length === 0 ? 'runs no space' : `runs ${row.spaces.map((space) => space.name).join(', ')}`)
  );
}
