import { MAX_LOGO_BYTES, type OrganizationListItem } from '@tmi/shared';

import { firstErrors } from './form-errors';
import { logoAttempts, logoContentType, logoProblem } from './logo-bytes';
import {
  EMPTY_ORG_FORM,
  formFromOrganization,
  formToInput,
  palettesOnOffer,
  slugFrom,
  validateOrgForm,
} from './org-form';

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
