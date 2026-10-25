import { PLATFORM_BRAND, type MyJoinRequest } from '@tmi/shared';

import {
  canMake,
  codeReady,
  deleteNameMatches,
  deviceTimeZone,
  makeProblem,
  mayDeleteSpace,
  shareText,
  splitRequests,
  spokenCode,
  standingLine,
} from './space-model';

const request = (slug: string, outcome: MyJoinRequest['outcome']): MyJoinRequest => ({
  slug,
  name: slug,
  short_name: slug,
  palette: 'teal',
  logo_mark_url: null,
  requested_at: '2026-10-24T12:00:00Z',
  outcome,
});

describe('space model (Phase 52)', () => {
  it('reads a code in any case, with or without the dash or spaces', () => {
    expect(codeReady('fmxy2345')).toBe(true);
    expect(codeReady('FMXY-2345')).toBe(true);
    expect(codeReady(' fmxy 2345 ')).toBe(true);
    expect(codeReady('FMXY-234O')).toBe(false); // an O is never in a code
    expect(codeReady('FMXY234')).toBe(false);
  });

  it('reads a code out one character at a time', () => {
    expect(spokenCode('FMXY-2345')).toBe('F M X Y, 2 3 4 5');
  });

  it('shares the space’s name, the code and the portal’s address', () => {
    expect(shareText('Ferreira Family Practice', 'FMXY-2345', 'https://x.example')).toBe(
      `Join Ferreira Family Practice on ${PLATFORM_BRAND.name} with the code FMXY-2345. https://x.example`,
    );
    expect(shareText('A', 'B')).toBe(`Join A on ${PLATFORM_BRAND.name} with the code B.`);
  });

  it('sends the device’s zone only when the platform keeps lessons on it', () => {
    expect(deviceTimeZone([{ timeZone: 'America/New_York' }])).toBe('America/New_York');
    expect(deviceTimeZone([{ timeZone: 'Europe/Lisbon' }])).toBeUndefined();
    expect(deviceTimeZone([])).toBeUndefined();
  });

  it('refuses a name before sending', () => {
    expect(makeProblem('A')).toBe('At least 2 characters.');
    expect(makeProblem('Family 123-45-6789')).toMatch(/Social Security/i);
    expect(makeProblem('Aimtrue official')).toBe('A space’s name cannot use the word “aimtrue”.');
    expect(makeProblem('The Creator family')).toBeNull();
  });

  it('splits requests into open and declined', () => {
    const { open, declined } = splitRequests([request('a', null), request('b', 'declined')]);
    expect(open.map((r) => r.slug)).toEqual(['a']);
    expect(declined.map((r) => r.slug)).toEqual(['b']);
  });

  it('lets adults (and anyone a space added) make a space', () => {
    expect(canMake(null)).toBe(true);
    expect(canMake({ age_band: 'adult' })).toBe(true);
    expect(canMake({ age_band: '13-17' })).toBe(false);
  });

  it('says why a found space cannot be asked', () => {
    expect(standingLine('member')).toBe('You already belong here.');
    expect(standingLine('requested')).toBe('You have asked already.');
    expect(standingLine(null)).toBeNull();
  });

  it('confirms a delete by the name, trimmed and in any case', () => {
    expect(deleteNameMatches(' maker test space ', 'Maker Test Space')).toBe(true);
    expect(deleteNameMatches('Maker', 'Maker Test Space')).toBe(false);
    expect(deleteNameMatches('', '')).toBe(false);
  });

  it('offers deleting only a self-serve space, to its admin', () => {
    expect(mayDeleteSpace({ created_via: 'self_serve' }, { roles: ['admin'] })).toBe(true);
    expect(mayDeleteSpace({ created_via: 'self_serve' }, { roles: ['parent'] })).toBe(false);
    expect(mayDeleteSpace({ created_via: 'console' }, { roles: ['admin'] })).toBe(false);
  });
});
