import { MAX_LOGO_BYTES, type OrganizationListItem } from '@tmi/shared';

import { firstErrors } from './form-errors';
import { logoAttempts, logoContentType, logoProblem } from './logo-bytes';
import {
  EMPTY_ORG_FORM,
  EMPTY_PAYER,
  formFromOrganization,
  payerForm,
  paymentModelChange,
  featuresBody,
  formToInput,
  palettesOnOffer,
  slugFrom,
  trustBody,
  validateOrgForm,
} from './org-form';
import { orgSummary } from './organizations-screen';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13];
const WEBP = [...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP'), ...ascii('VP8 ')];

describe('logo bytes', () => {
  it('knows PNG and WebP by their bytes, and nothing else', () => {
    expect(logoContentType(bytes(...PNG))).toBe('image/png');
    expect(logoContentType(bytes(...WEBP))).toBe('image/webp');
    expect(logoContentType(bytes(...ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(logoContentType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0))).toBeNull(); // JPEG
    expect(logoContentType(bytes(...ascii('GIF89a')))).toBeNull();
    expect(logoContentType(bytes())).toBeNull();
  });

  it('refuses an empty, an oversized or a foreign file in the server’s words', () => {
    expect(logoProblem(bytes())).toBe('Choose an image.');
    const big = new Uint8Array(MAX_LOGO_BYTES + 1);
    big.set(PNG);
    expect(logoProblem(big)).toBe('A logo may be at most 256 KB.');
    expect(logoProblem(bytes(...ascii('<svg></svg>')))).toMatch(/PNG or WebP/);
    expect(logoProblem(bytes(...PNG))).toBeNull();
  });

  it('shrinks to the kind’s size, never enlarges, and falls back to smaller WebP', () => {
    expect(logoAttempts('mark', 400, 300)).toEqual([
      { format: 'png', resize: null },
      { format: 'webp', compress: 0.85, resize: null },
      { format: 'webp', compress: 0.7, resize: { width: 256 } },
    ]);
    expect(logoAttempts('full', 3000, 1000)[0]).toEqual({ format: 'png', resize: { width: 1024 } });
    expect(logoAttempts('mark', 800, 2000)[0]).toEqual({ format: 'png', resize: { height: 512 } });
  });
});

const ORG: OrganizationListItem = {
  id: 'o1',
  slug: 'lakeside',
  name: 'Lakeside Learning',
  short_name: 'Lakeside',
  tagline: null,
  blurb: 'A blurb',
  place: null,
  palette: 'plum',
  builtin_logo: 'institute',
  logo_mark_url: null,
  logo_full_url: null,
  time_zone: 'America/Chicago',
  email_notifications: true,
  canvas_assessments: false,
  canvas_assessments_unreviewed: false,
  checked_questions: false,
  personal: false,
  canvas_assessment_questions: 10,
  gamify_question_quest: false,
  feature_tutoring: true,
  feature_assessment: true,
  feature_quest: false,
  created_via: 'console',
  quest_trusted: true,
  business: { id: 'b-1', name: 'Fixture Payer' },
  calendar_domain: 'lakeside.invalid',
  archived_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  admin_count: 1,
  member_count: 3,
};

describe('organization form', () => {
  it('suggests an address name from the name', () => {
    expect(slugFrom('Lakeside Learning')).toBe('lakeside-learning');
    expect(slugFrom('  Café & Co. -- Maths! ')).toBe('cafe-co-maths');
    expect(slugFrom('x'.repeat(60))).toHaveLength(40);
  });

  it('round-trips an organization into the body the web sends', () => {
    const form = formFromOrganization(ORG);
    expect(form).toMatchObject({ tagline: '', blurb: 'A blurb', builtin_institute: true, palette: 'plum' });
    expect(formToInput(form)).toEqual({
      name: 'Lakeside Learning',
      short_name: 'Lakeside',
      slug: 'lakeside',
      tagline: '',
      blurb: 'A blurb',
      place: '',
      palette: 'plum',
      time_zone: 'America/Chicago',
      email_notifications: true,
      builtin_logo: 'institute',
    });
    expect(formToInput({ ...form, builtin_institute: false }).builtin_logo).toBeNull();
    // Phase 50: the feature sets go on a create only.
    expect(
      formToInput({ ...form, features: { tutoring: false, assessment: true, quest: true } }, true),
    ).toMatchObject({
      feature_tutoring: false,
      feature_assessment: true,
      feature_quest: true,
    });
    // Owner, 2026-11-04: a new space starts with Quest alone.
    expect(EMPTY_ORG_FORM.features).toEqual({ tutoring: false, assessment: false, quest: true });
    expect(formToInput(EMPTY_ORG_FORM, true)).toMatchObject({
      feature_tutoring: false,
      feature_assessment: false,
      feature_quest: true,
    });
    expect(formFromOrganization(null)).toBe(EMPTY_ORG_FORM);
  });

  it('offers plum only with the built-in logo, or to an organization already wearing it', () => {
    expect(palettesOnOffer({ palette: 'teal', builtin_institute: false })).not.toContain('plum');
    expect(palettesOnOffer({ palette: 'teal', builtin_institute: true })).toContain('plum');
    expect(palettesOnOffer({ palette: 'plum', builtin_institute: false })).toContain('plum');
  });

  it('validates with the shared schema, field by field', () => {
    const verdict = validateOrgForm({ ...EMPTY_ORG_FORM, slug: '-Bad-' }, true);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.errors.name).toBe('Name is required.');
    expect(verdict.errors.short_name).toBe('Short name is required.');
    expect(verdict.errors.slug).toBeDefined();
    expect(validateOrgForm(formFromOrganization(ORG), false).ok).toBe(true);
  });

  it('keeps the first message per field', () => {
    expect(
      firstErrors([
        { path: ['email'], message: 'first' },
        { path: ['email'], message: 'second' },
        { path: [], message: 'whole' },
      ]),
    ).toEqual({ email: 'first', form: 'whole' });
  });
});

describe('feature sets (Phase 50)', () => {
  it('names the allowed sets at the end of the console row', () => {
    expect(orgSummary(ORG)).toBe(
      'lakeside · Plum · 1 admin · 3 members · Tutoring, Assessment · families pay the space',
    );
    expect(
      orgSummary({ ...ORG, feature_tutoring: false, feature_assessment: false, feature_quest: false }),
    ).toMatch(/· No feature sets · families pay the space$/);
  });

  it('sends all three, with the one switched changed', () => {
    expect(featuresBody(ORG, 'quest', true)).toEqual({
      feature_tutoring: true,
      feature_assessment: true,
      feature_quest: true,
    });
    expect(featuresBody(ORG, 'tutoring', false)).toEqual({
      feature_tutoring: false,
      feature_assessment: true,
      feature_quest: false,
    });
  });
});

describe('Quest trust (Phase 51)', () => {
  it('reads the trust into the form, on unless switched off', () => {
    expect(formFromOrganization(ORG).quest_trusted).toBe(true);
    expect(formFromOrganization({ ...ORG, quest_trusted: false }).quest_trusted).toBe(false);
  });

  it('sends the features PUT, with the sets as they stand, only when the trust changed', () => {
    expect(trustBody(ORG, true)).toBeNull();
    expect(trustBody(ORG, false)).toEqual({
      feature_tutoring: true,
      feature_assessment: true,
      feature_quest: false,
      quest_trusted: false,
    });
    expect(trustBody({ ...ORG, quest_trusted: false }, true)).toMatchObject({ quest_trusted: true });
  });

  it('never sends the trust in the identity body', () => {
    expect(formToInput(formFromOrganization(ORG))).not.toHaveProperty('quest_trusted');
  });
});

describe('checked questions (Phase 62, P1)', () => {
  it('reads the switch into the form, on unless switched off', () => {
    expect(formFromOrganization({ ...ORG, checked_questions: true }).checked_questions).toBe(true);
    expect(formFromOrganization(ORG).checked_questions).toBe(false);
    expect(EMPTY_ORG_FORM.checked_questions).toBe(true);
  });

  it('sends the features PUT with both switches when either changed, else nothing', () => {
    expect(trustBody(ORG, true, false)).toBeNull();
    expect(trustBody(ORG, true, true)).toEqual({
      feature_tutoring: true,
      feature_assessment: true,
      feature_quest: false,
      quest_trusted: true,
      checked_questions: true,
    });
    expect(trustBody(ORG, false, false)).toMatchObject({ quest_trusted: false, checked_questions: false });
  });

  it('never sends the switch in the identity body', () => {
    expect(formToInput(formFromOrganization(ORG))).not.toHaveProperty('checked_questions');
  });
});

describe('who families pay (Phase 59, S2)', () => {
  const PAYER = {
    name: 'Lakeside Payer LLC',
    tin: '12-3456789',
    payer_address_line1: '1 Main St',
    payer_address_line2: null,
    payer_city: 'Durham',
    payer_state: 'NC',
    payer_postal_code: '27701',
  };

  it('says who families pay at the end of the row', () => {
    expect(orgSummary({ ...ORG, business: null })).toMatch(/· families pay each tutor$/);
    expect(orgSummary(ORG)).toMatch(/· families pay the space$/);
  });

  it('reads the model and the payer details into the form', () => {
    expect(formFromOrganization(ORG).payment_model).toBe('space');
    expect(formFromOrganization({ ...ORG, business: null }).payment_model).toBe('direct');
    expect(formFromOrganization(null).payment_model).toBe('direct');
    expect(formFromOrganization({ ...ORG, payer: PAYER }).payer).toEqual({
      payer_name: 'Lakeside Payer LLC',
      tin: '12-3456789',
      payer_address_line1: '1 Main St',
      payer_address_line2: '',
      payer_city: 'Durham',
      payer_state: 'NC',
      payer_postal_code: '27701',
    });
    // A Worker before Phase 59 sends no payer.
    expect(formFromOrganization(ORG).payer).toEqual(EMPTY_PAYER);
  });

  it('creates with the model, and the payer fields filled in only for "The space"', () => {
    const fresh = { ...formFromOrganization(null), name: 'New', short_name: 'New', slug: 'new' };
    const direct = formToInput({ ...fresh, payer: { ...EMPTY_PAYER, tin: '12-3456789' } }, true);
    expect(direct).toMatchObject({ payment_model: 'direct' });
    expect(direct).not.toHaveProperty('tin');
    expect(direct).not.toHaveProperty('business_id');
    const collecting = formToInput(
      { ...fresh, payment_model: 'space', payer: { ...EMPTY_PAYER, payer_name: 'New LLC', tin: '12-3456789' } },
      true,
    );
    expect(collecting).toMatchObject({ payment_model: 'space', payer_name: 'New LLC', tin: '12-3456789' });
    expect(collecting).not.toHaveProperty('payer_city');
  });

  it('edits send only the payer fields that changed, and never the model', () => {
    const org = { ...ORG, payer: PAYER };
    const loaded = payerForm(org.payer);
    const form = formFromOrganization(org);
    expect(formToInput(form, false, loaded)).not.toHaveProperty('tin');
    expect(formToInput(form, false, loaded)).not.toHaveProperty('payment_model');
    const changed = formToInput({ ...form, payer: { ...form.payer, payer_city: 'Cary' } }, false, loaded);
    expect(changed).toMatchObject({ payer_city: 'Cary' });
    expect(changed).not.toHaveProperty('tin');
    // Families pay each tutor: no payer field travels, whatever the form holds.
    expect(formToInput({ ...form, payment_model: 'direct', payer: EMPTY_PAYER }, false, loaded)).not.toHaveProperty(
      'tin',
    );
  });

  it('puts the model only when it changed', () => {
    expect(paymentModelChange(ORG, { payment_model: 'space' })).toBeNull();
    expect(paymentModelChange(ORG, { payment_model: 'direct' })).toEqual({ model: 'direct' });
    expect(paymentModelChange({ business: null }, { payment_model: 'space' })).toEqual({ model: 'space' });
  });

  it('validates the payer fields with the shared schema: no SSN as a TIN', () => {
    const form = { ...formFromOrganization(ORG), payer: { ...EMPTY_PAYER, tin: '123-45-6789' } };
    const verdict = validateOrgForm(form, false, EMPTY_PAYER);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.errors.tin).toBeTruthy();
  });
});
