import { MAX_LOGO_BYTES, type OrganizationListItem } from '@tmi/shared';

import { firstErrors } from './form-errors';
import { logoAttempts, logoContentType, logoProblem } from './logo-bytes';
import {
  EMPTY_ORG_FORM,
  DIRECT,
  businessChange,
  formFromOrganization,
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
  canvas_assessment_questions: 10,
  gamify_question_quest: false,
  feature_tutoring: true,
  feature_assessment: true,
  feature_quest: false,
  created_via: 'console',
  quest_trusted: true,
  business: { id: 'b-1', name: 'Fixture Organization' },
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
    expect(EMPTY_ORG_FORM.features).toEqual({ tutoring: true, assessment: true, quest: true });
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
      'lakeside · Plum · 1 admin · 3 members · Tutoring, Assessment · run by Fixture Organization',
    );
    expect(
      orgSummary({ ...ORG, feature_tutoring: false, feature_assessment: false, feature_quest: false }),
    ).toMatch(/· No feature sets · run by/);
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

describe('the organization that runs a space (Phase 54)', () => {
  it('says who families pay at the end of the row', () => {
    expect(orgSummary({ ...ORG, business: null })).toMatch(/· paid directly$/);
  });

  it('reads the organization into the form, or paid directly', () => {
    expect(formFromOrganization(ORG).business_id).toBe('b-1');
    expect(formFromOrganization({ ...ORG, business: null }).business_id).toBe(DIRECT);
    expect(formFromOrganization(null).business_id).toBe(DIRECT);
  });

  it('sends business_id on create, null for paid directly, and never in the edit body', () => {
    const fresh = { ...formFromOrganization(null), name: 'New', short_name: 'New', slug: 'new' };
    expect(formToInput(fresh, true)).toMatchObject({ business_id: null });
    expect(formToInput({ ...fresh, business_id: 'b-2' }, true)).toMatchObject({ business_id: 'b-2' });
    expect(formToInput(formFromOrganization(ORG))).not.toHaveProperty('business_id');
  });

  it('puts the new organization only when it changed', () => {
    expect(businessChange(ORG, { business_id: 'b-1' })).toBeNull();
    expect(businessChange(ORG, { business_id: DIRECT })).toEqual({ business_id: null });
    expect(businessChange({ business: null }, { business_id: 'b-2' })).toEqual({ business_id: 'b-2' });
  });
});
