// The organization form's state and its translation to the API, from
// apps/web/src/features/platform/organization-dialog.tsx @ 1132322 (FormState, EMPTY, slugFrom, save).
// Validated with the shared schemas, as the server will. Phase 50 @ 2471d84 (working tree): the
// feature sets an organization is allowed, chosen when it is created (the detail screen's Feature
// sets section changes them after that). Phase 59 @ f96b984 (working tree, docs/spaces-plan.md S2): who
// families pay -- the space (its own payer details) or each tutor directly -- replaces choosing a
// business: sent on create as `payment_model` with the payer fields, and on edit by its own PUT
// (`paymentModelChange`) before the PATCH carries the payer fields that changed (`payerChanges`).
import {
  ORG_PALETTES,
  SPACE_PAYER_FIELDS,
  createOrganizationSchema,
  spacePaymentModel,
  updateOrganizationSchema,
  featureAllowed,
  type CreateOrganizationInput,
  type OrganizationFeaturesInput,
  type FeatureSet,
  type OrgPalette,
  type OrgTimeZone,
  type OrganizationListItem,
  type SpacePayer,
  type SpacePayerField,
  type SpacePaymentModel,
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
  /** Phase 62 (P1): whether its games, tiles and Assessments also draw checked ("Beta") questions (edit only). */
  checked_questions: boolean;
  /** Phase 59: who families pay -- the space, or each tutor directly. */
  payment_model: SpacePaymentModel;
  /** Its payer details while the space collects payments, in the request's names; '' when empty. */
  payer: PayerFormState;
}

/** The payer fields as the form holds them, keyed as the request sends them (`payer_name`, `tin`, …). */
export type PayerFormState = Record<SpacePayerField, string>;

export const EMPTY_PAYER: PayerFormState = Object.fromEntries(
  SPACE_PAYER_FIELDS.map((key) => [key, '']),
) as PayerFormState;

/** A space's payer details (the console's `payer`, the name as `name`) into the form's fields. */
export function payerForm(payer: SpacePayer | null | undefined): PayerFormState {
  if (!payer) return EMPTY_PAYER;
  return Object.fromEntries(
    SPACE_PAYER_FIELDS.map((key) => [key, (key === 'payer_name' ? payer.name : payer[key]) ?? '']),
  ) as PayerFormState;
}

/** The payer fields that differ from what was loaded, to send. */
export function payerChanges(form: PayerFormState, loaded: PayerFormState): Partial<PayerFormState> {
  return Object.fromEntries(
    SPACE_PAYER_FIELDS.filter((key) => form[key] !== loaded[key]).map((key) => [key, form[key]]),
  ) as Partial<PayerFormState>;
}

// Owner, 2026-11-04: a new space starts with Quest alone; the rest are ticked as needed.
const NEW_FEATURES: Record<FeatureSet, boolean> = { tutoring: false, assessment: false, quest: true };

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
  features: NEW_FEATURES,
  quest_trusted: true,
  checked_questions: true,
  payment_model: 'direct',
  payer: EMPTY_PAYER,
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
    // On an edit the sets are not sent (the space's screen switches them); they decide what the form shows.
    features: {
      tutoring: featureAllowed(org, 'tutoring'),
      assessment: featureAllowed(org, 'assessment'),
      quest: featureAllowed(org, 'quest'),
    },
    quest_trusted: org.quest_trusted !== false,
    checked_questions: org.checked_questions !== false,
    payment_model: spacePaymentModel(org),
    payer: payerForm(org.payer),
  };
}

/** Phase 59: after an edit, the `PUT …/payment-model` body when who families pay changed, else null. */
export function paymentModelChange(
  org: Pick<OrganizationListItem, 'business'>,
  form: Pick<OrgFormState, 'payment_model'>,
): { model: SpacePaymentModel } | null {
  return spacePaymentModel(org) === form.payment_model ? null : { model: form.payment_model };
}

/**
 * The body both create and update send: every field, as the web dialog does. Creating also sends
 * the three feature sets and who families pay; editing leaves the sets to the "This space may use"
 * section. While the space collects payments, the payer fields go too: on create those filled in,
 * on edit those changed from `loaded` (the space's payer as it was read).
 */
export function formToInput(
  form: OrgFormState,
  creating = false,
  loaded: PayerFormState = EMPTY_PAYER,
): CreateOrganizationInput & UpdateOrganizationInput {
  const features = creating
    ? {
        feature_tutoring: form.features.tutoring,
        feature_assessment: form.features.assessment,
        feature_quest: form.features.quest,
        // Phase 59: who families pay.
        payment_model: form.payment_model,
      }
    : {};
  const payer = form.payment_model === 'space' ? payerChanges(form.payer, loaded) : {};
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
    ...payer,
  };
}

/**
 * The palettes on offer. Plum is the institute's own and goes with its built-in logo: shown only
 * when that logo is worn, or when the space already wears plum.
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
export function validateOrgForm(
  form: OrgFormState,
  creating: boolean,
  loaded: PayerFormState = EMPTY_PAYER,
): OrgFormVerdict {
  const input = formToInput(form, creating, loaded);
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
 *
 * Phase 62 (P1, docs/stickiness-plan.md; the web's organization-dialog.tsx, working tree): given
 * `checked` too, the platform's "Checked questions (Beta)" switch travels in the same PUT, and the PUT
 * is sent when either changed. Without it, as before: the server leaves `checked_questions` alone.
 */
export function trustBody(
  org: Pick<
    OrganizationListItem,
    'feature_tutoring' | 'feature_assessment' | 'feature_quest' | 'quest_trusted'
  > &
    Partial<Pick<OrganizationListItem, 'checked_questions'>>,
  trusted: boolean,
  checked?: boolean,
): OrganizationFeaturesInput | null {
  const trustChanged = (org.quest_trusted !== false) !== trusted;
  const checkedChanged = checked !== undefined && (org.checked_questions !== false) !== checked;
  if (!trustChanged && !checkedChanged) return null;
  return {
    feature_tutoring: featureAllowed(org, 'tutoring'),
    feature_assessment: featureAllowed(org, 'assessment'),
    feature_quest: featureAllowed(org, 'quest'),
    quest_trusted: trusted,
    ...(checked === undefined ? {} : { checked_questions: checked }),
  };
}
