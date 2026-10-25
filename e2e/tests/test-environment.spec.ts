import { test, expect } from '../support/fixtures.js';
import { invitedMatch } from '@tmi/shared';

/**
 * Phase 53 (docs/test-environment-plan.md): the test portal lets in only the people on its invited
 * list. The Worker's path is checked by hand against a Worker with sign-in on (the plan records
 * it); here, the matching itself: an address, a pattern with `*` and `?`, or a Google id.
 */
test.describe('the test portal’s invited list (Phase 53)', () => {
  const list = [
    { email: 'Nav.Owner@Example.com', provider: null, subject: null },
    { email: '*@trianglemathinstitute.com', provider: null, subject: null },
    { email: 'tester?@gmail.com', provider: null, subject: null },
    { email: null, provider: 'google', subject: '1234567890' },
  ];
  const ok = (email: string | null, googleSub: string | null = null) => invitedMatch(list, { email, googleSub });

  test('an address matches itself, whatever its case', () => {
    expect(ok('nav.owner@example.com')).toBe(true);
    expect(ok('NAV.OWNER@EXAMPLE.COM')).toBe(true);
    expect(ok('nav.owner@example.co')).toBe(false);
  });

  test('a pattern: * any run, ? one character, nothing else special', () => {
    expect(ok('anyone@trianglemathinstitute.com')).toBe(true);
    expect(ok('anyone@trianglemathinstitute.com.evil.org')).toBe(false);
    expect(ok('tester1@gmail.com')).toBe(true);
    expect(ok('tester12@gmail.com')).toBe(false);
    // A dot is a dot, not "any character".
    expect(invitedMatch([{ email: 'a.b@x.com', provider: null, subject: null }], { email: 'axb@x.com', googleSub: null })).toBe(false);
  });

  test('a Google id matches whatever the address', () => {
    expect(ok('someone.else@gmail.com', '1234567890')).toBe(true);
    expect(ok('someone.else@gmail.com', '999')).toBe(false);
    expect(ok(null, null)).toBe(false);
  });
});
