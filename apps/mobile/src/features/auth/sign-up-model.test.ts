import { PRIVACY_VERSION, TERMS_VERSION } from '@tmi/shared';

import { birthYears, firstNameOf, legalUrl, MONTHS, signupRequest } from './sign-up-model';

describe('sign-up model (Phase 52)', () => {
  it('sends Google’s token with the current versions', () => {
    expect(
      signupRequest(
        { birth_year: 1990, birth_month: 6 },
        { token: 't-1', email: 'nina@example.com', name: 'Nina', dev: false },
      ),
    ).toEqual({ token: 't-1', birth_year: 1990, birth_month: 6, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
  });

  it('sends the developer email and name in place of a token', () => {
    const body = signupRequest(
      { birth_year: 1990, birth_month: 6, dev_name: '  Sam Signup ' },
      { token: null, email: 'sam@example.com', name: 'sam@example.com', dev: true },
    );
    expect(body).toEqual({
      dev_email: 'sam@example.com',
      dev_name: 'Sam Signup',
      birth_year: 1990,
      birth_month: 6,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    });
    expect(
      signupRequest({ birth_year: 1990, birth_month: 1, dev_name: ' ' }, { token: null, email: 'a@b.c', name: 'a@b.c', dev: true }),
    ).not.toHaveProperty('dev_name');
  });

  it('offers this year back 100, and the twelve months', () => {
    const years = birthYears(new Date(2026, 9, 24));
    expect(years).toHaveLength(100);
    expect(years[0]).toBe(2026);
    expect(years.at(-1)).toBe(1927);
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS[5]).toBe('June');
  });

  it('greets by first name, or an address’s local part', () => {
    expect(firstNameOf('Sam Signup')).toBe('Sam');
    expect(firstNameOf('sam.signup@example.com')).toBe('sam.signup');
  });

  it('links the portal’s own pages', () => {
    expect(legalUrl('terms', 'http://localhost:8787')).toBe('http://localhost:8787/terms');
    expect(legalUrl('privacy', 'https://x.example/')).toBe('https://x.example/privacy');
  });
});
