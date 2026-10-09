// The payer box as the Organization screen's form holds it, from
// apps/web/src/features/organizations/organization-settings-page.tsx @ 1132322. The notifications
// switch saves on its own, so it is not part of the form.
import { updateOrganizationSettingsSchema, type OrganizationSettings } from '@tmi/shared';

export const PAYER_FIELDS = [
  'tin',
  'payer_address_line1',
  'payer_address_line2',
  'payer_city',
  'payer_state',
  'payer_postal_code',
] as const;

export type PayerField = (typeof PAYER_FIELDS)[number];
export type SettingsForm = Record<PayerField, string>;

export const EMPTY_FORM: SettingsForm = {
  tin: '',
  payer_address_line1: '',
  payer_address_line2: '',
  payer_city: '',
  payer_state: '',
  payer_postal_code: '',
};

export function formFromSettings(settings: OrganizationSettings): SettingsForm {
  return Object.fromEntries(PAYER_FIELDS.map((key) => [key, settings[key] ?? ''])) as SettingsForm;
}

/**
 * The shared schema's verdict on the form: the payload to send, or one message per field. The
 * schema's `optionalText` carries the SSN guard, so an SSN-shaped TIN -- a sole proprietor's own
 * number -- is refused here, before any request.
 */
export function validateForm(
  form: SettingsForm,
): { ok: true; payload: SettingsForm } | { ok: false; errors: Record<string, string> } {
  const parsed = updateOrganizationSettingsSchema.safeParse(form);
  if (parsed.success) return { ok: true, payload: form };
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join('.') || 'form';
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}
