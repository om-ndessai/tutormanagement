// The organization form's state and its translation to the API, from
// apps/web/src/features/platform/organization-dialog.tsx @ 1132322 (FormState, EMPTY, slugFrom, save).
// Validated with the shared schemas, as the server will. Phase 50 @ 2471d84 (working tree): the
// feature sets an organization is allowed, chosen when it is created (the detail screen's Feature
// sets section changes them after that). Phase 54 @ 24066d9 (working tree): the organization that runs
// its money, or "paid directly" (DIRECT); sent on create, and on edit by its own PUT (`businessChange`).
import {
  ORG_PALETTES,
  createOrganizationSchema,
  updateOrganizationSchema,
  featureAllowed,
  type CreateOrganizationInput,
  type OrganizationFeaturesInput,
  type FeatureSet,
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
  /** Phase 50: the feature sets it is allowed; sent on create only. */
  features: Record<FeatureSet, boolean>;
  /** Phase 51: whether its Quest reviews approve bank questions for everybody (edit only). */
  quest_trusted: boolean;
  /** Phase 54: the organization (a business) that runs its money, or DIRECT: paid directly. */
  business_id: string;
}

/** The form's value for "no organization": the space is paid directly. */
export const DIRECT = 'direct';

const ALL_FEATURES: Record<FeatureSet, boolean> = { tutoring: true, assessment: true, quest: true };

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
  features: ALL_FEATURES,
  quest_trusted: true,
  business_id: DIRECT,
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
    features: ALL_FEATURES,
    quest_trusted: org.quest_trusted !== false,
    business_id: org.business?.id ?? DIRECT,
  };
}

/** Phase 54: the business id to send, null for paid directly. */
export function businessIdOf(form: Pick<OrgFormState, 'business_id'>): string | null {
  return form.business_id === DIRECT ? null : form.business_id;
}

/** Phase 54: after an edit, the `PUT …/business` body when the organization changed, else null. */
export function businessChange(
  org: Pick<OrganizationListItem, 'business'>,
  form: Pick<OrgFormState, 'business_id'>,
): { business_id: string | null } | null {
  const next = businessIdOf(form);
  return (org.business?.id ?? null) === next ? null : { business_id: next };
}

/**
 * The body both create and update send: every field, as the web dialog does. Creating also sends
 * the three feature sets; editing leaves them to the Feature sets section.
 */
export function formToInput(
  form: OrgFormState,
  creating = false,
): CreateOrganizationInput & UpdateOrganizationInput {
  const features = creating
    ? {
        feature_tutoring: form.features.tutoring,
        feature_assessment: form.features.assessment,
        feature_quest: form.features.quest,
        // Phase 54: who families pay; null is paid directly.
        business_id: businessIdOf(form),
      }
    : {};
  return {
    ...features,
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
  const input = formToInput(form, creating);
  const result = (creating ? createOrganizationSchema : updateOrganizationSchema).safeParse(input);
  if (result.success) return { ok: true, input };
  return { ok: false, errors: firstErrors(result.error.issues) };
}

/** The body a change sends: all three, with one set changed. */
export function featuresBody(
  org: Pick<OrganizationListItem, 'feature_tutoring' | 'feature_assessment' | 'feature_quest'>,
  set: FeatureSet,
  allowed: boolean,
): OrganizationFeaturesInput {
  const body: OrganizationFeaturesInput = {
    feature_tutoring: featureAllowed(org, 'tutoring'),
    feature_assessment: featureAllowed(org, 'assessment'),
    feature_quest: featureAllowed(org, 'quest'),
  };
  body[`feature_${set}`] = allowed;
  return body;
}

/**
 * Phase 51 (the web's organization-dialog.tsx @ 9485a8e): after an edit, the features PUT to send
 * when the Quest trust changed -- the three sets as they stand, with `quest_trusted` -- else null.
 * (The sets themselves change on the organization screen's Feature sets section.)
 */
export function trustBody(
  org: Pick<
    OrganizationListItem,
    'feature_tutoring' | 'feature_assessment' | 'feature_quest' | 'quest_trusted'
  >,
  trusted: boolean,
): OrganizationFeaturesInput | null {
  if ((org.quest_trusted !== false) === trusted) return null;
  return {
    feature_tutoring: featureAllowed(org, 'tutoring'),
    feature_assessment: featureAllowed(org, 'assessment'),
    feature_quest: featureAllowed(org, 'quest'),
    quest_trusted: trusted,
  };
}
