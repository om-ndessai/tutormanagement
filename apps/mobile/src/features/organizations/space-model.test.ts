import { PLATFORM_BRAND, type MyJoinRequest } from '@tmi/shared';

import {
  accountBadgeCount,
  answeredRequests,
  canMake,
  codeReady,
  deleteNameMatches,
  deviceTimeZone,
  makeProblem,
  mayDeleteSpace,
  mayMakeOwnSpace,
  requestAnswersWaiting,
  requestLine,
  shareText,
  showsPersonalOffer,
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

  it('splits requests into open, let in and declined', () => {
    const { open, approved, declined } = splitRequests([
      request('a', null),
      request('b', 'declined'),
      request('c', 'approved'),
    ]);
    expect(open.map((r) => r.slug)).toEqual(['a']);
    expect(approved.map((r) => r.slug)).toEqual(['c']);
    expect(declined.map((r) => r.slug)).toEqual(['b']);
  });
});

describe('the spaces’ answers, until dismissed (UI audit JF5)', () => {
  const all = [request('a', null), request('b', 'declined'), request('c', 'approved')];

  it('the answers are the let in and the declined, in order; the waiting one is not', () => {
    expect(answeredRequests(all).map((r) => r.slug)).toEqual(['b', 'c']);
  });

  it('the account button counts invitations and answers, not waiting requests', () => {
    expect(accountBadgeCount(0, [])).toBe(0);
    expect(accountBadgeCount(1, [request('a', null)])).toBe(1);
    expect(accountBadgeCount(2, all)).toBe(4);
    expect(requestAnswersWaiting(1)).toBe('1 answer to your request');
    expect(requestAnswersWaiting(2)).toBe('2 answers to your requests');
  });

  it('says each standing in words', () => {
    // The web's words (request-outcomes.tsx).
    expect(requestLine({ name: 'Riverside', outcome: null })).toBe(
      'Asked to join Riverside · waiting for its admins.',
    );
    expect(requestLine({ name: 'Riverside', outcome: 'approved' })).toBe("You're in Riverside.");
    expect(requestLine({ name: 'Riverside', outcome: 'declined' })).toBe('Riverside did not let you in.');
  });
});

describe('space model, continued', () => {
  it('lets adults make a space, and those a space added only through an adult’s role (S11)', () => {
    expect(canMake({ age_band: 'adult' })).toBe(true);
    expect(canMake({ age_band: '13-17' })).toBe(false);
    expect(canMake({ age_band: '13-17' }, [{ roles: ['parent'] }])).toBe(false);
    // Added by a space, no age given: a role a child does not hold vouches; a student's does not.
    expect(canMake(null, [{ roles: ['parent'] }])).toBe(true);
    expect(canMake(null, [{ roles: ['student'] }, { roles: ['tutor', 'student'] }])).toBe(true);
    expect(canMake(null, [{ roles: ['student'] }])).toBe(false);
    expect(canMake(null, [])).toBe(false);
    expect(canMake(null)).toBe(false);
    expect(canMake(null, [], true)).toBe(true);
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

describe('a space of one\'s own (Phase 80, A12, A13)', () => {
  const adult = { age_band: 'adult' as const };
  const teen = { age_band: '13-17' as const };

  it('offers "Make my own space" to a self sign-up with none -- teens too -- and to nobody a space added', () => {
    expect(mayMakeOwnSpace(adult, [])).toBe(true);
    expect(mayMakeOwnSpace(teen, [])).toBe(true);
    expect(mayMakeOwnSpace(adult, [{ personal: false }, {}])).toBe(true);
    expect(mayMakeOwnSpace(adult, [{ personal: false }, { personal: true }])).toBe(false);
    expect(mayMakeOwnSpace(null, [])).toBe(false);
    expect(mayMakeOwnSpace(undefined, [{ personal: false }])).toBe(false);
  });

  it('shows the home\'s offer only while the session offers it, inside a space that is not their own', () => {
    expect(showsPersonalOffer(true, { personal: false })).toBe(true);
    expect(showsPersonalOffer(false, { personal: false })).toBe(false);
    expect(showsPersonalOffer(true, null)).toBe(false);
    expect(showsPersonalOffer(true, { personal: true })).toBe(false);
  });
});
