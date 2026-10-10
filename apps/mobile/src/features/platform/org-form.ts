// The organization form's state and its translation to the API, from
// apps/web/src/features/platform/organization-dialog.tsx @ 1132322 (FormState, EMPTY, slugFrom, save).
// Validated with the shared schemas, as the server will.
import {
  ORG_PALETTES,
  createOrganizationSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type OrgPalette,
  type OrgTimeZone,
  type OrganizationListItem,
  type UpdateOrganizationInput,
} from '@tmi/shared';

import { firstErrors } from './form-errors';

export interface OrgFormState {
  name: string;
  short_name: string;
  slug: string;
  tagline: string;
  blurb: string;
  place: string;
  palette: OrgPalette;
  time_zone: OrgTimeZone;
  builtin_institute: boolean;
  email_notifications: boolean;
}

export const EMPTY_ORG_FORM: OrgFormState = {
  name: '',
  short_name: '',
  slug: '',
  tagline: '',
  blurb: '',
  place: '',
  palette: 'platform',
  time_zone: 'America/New_York',
  builtin_institute: false,
  email_notifications: false,
};

/** "Lakeside Learning" -> "lakeside-learning", as a first suggestion. */
export function slugFrom(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function formFromOrganization(org: OrganizationListItem | null): OrgFormState {
  if (!org) return EMPTY_ORG_FORM;
  return {
    name: org.name,
    short_name: org.short_name,
    slug: org.slug,
    tagline: org.tagline ?? '',
    blurb: org.blurb ?? '',
    place: org.place ?? '',
    palette: org.palette,
    time_zone: org.time_zone,
    builtin_institute: org.builtin_logo === 'institute',
    email_notifications: org.email_notifications,
  };
}

/** The body both create and update send: every field, as the web dialog does. */
export function formToInput(form: OrgFormState): CreateOrganizationInput & UpdateOrganizationInput {
  return {
    name: form.name,
    short_name: form.short_name,
    slug: form.slug,
    tagline: form.tagline,
    blurb: form.blurb,
    place: form.place,
    palette: form.palette,
    time_zone: form.time_zone,
    email_notifications: form.email_notifications,
    builtin_logo: form.builtin_institute ? 'institute' : null,
  };
}

/**
 * The palettes on offer. Plum is the institute's own and goes with its built-in logo: shown only
 * when that logo is worn, or when the organization already wears plum.
 */
export function palettesOnOffer(form: Pick<OrgFormState, 'palette' | 'builtin_institute'>): OrgPalette[] {
  return ORG_PALETTES.filter(
    (palette) => palette !== 'plum' || form.builtin_institute || form.palette === 'plum',
  );
}

export type OrgFormVerdict =
  | { ok: true; input: CreateOrganizationInput & UpdateOrganizationInput }
  | { ok: false; errors: Record<string, string> };

/** The shared schema's verdict on the form, field by field. */
export function validateOrgForm(form: OrgFormState, creating: boolean): OrgFormVerdict {
  const input = formToInput(form);
  const result = (creating ? createOrganizationSchema : updateOrganizationSchema).safeParse(input);
  if (result.success) return { ok: true, input };
  return { ok: false, errors: firstErrors(result.error.issues) };
}
