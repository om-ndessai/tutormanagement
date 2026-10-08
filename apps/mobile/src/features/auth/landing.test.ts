import type { SessionResponse } from '@tmi/shared';

import { decideLanding } from './landing';

type M = SessionResponse['memberships'][number];
const membership = (slug: string, extra: Partial<M> = {}): M =>
  ({ slug, name: slug, status: 'active', is_default: false, ...extra }) as M;

function session(over: Partial<SessionResponse>): SessionResponse {
  return {
    user: null,
    impersonated: true,
    onboarding: null,
    organization: null,
    memberships: [],
    invitations: [],
    platform_admin: false,
    ...over,
  } as unknown as SessionResponse;
}

describe('decideLanding (ported from the web applySession)', () => {
  it('lands an arriving person in their default organization', () => {
    const s = session({
      organization: { slug: 'chmi' } as SessionResponse['organization'],
      memberships: [membership('chmi'), membership('riverside', { is_default: true })],
    });
    expect(decideLanding(s, true)).toEqual({ kind: 'enter', slug: 'riverside', reason: 'default' });
  });

  it('keeps the chosen organization once the person is no longer arriving', () => {
    const s = session({
      organization: { slug: 'chmi' } as SessionResponse['organization'],
      memberships: [membership('chmi'), membership('riverside', { is_default: true })],
    });
    expect(decideLanding(s, false)).toEqual({ kind: 'in', slug: 'chmi' });
  });

  it('ignores a default the person may no longer enter', () => {
    const s = session({
      memberships: [membership('chmi'), membership('riverside', { is_default: true, status: 'suspended' })],
    });
    expect(decideLanding(s, true)).toEqual({ kind: 'enter', slug: 'chmi', reason: 'single' });
  });

  it('goes straight into a single organization', () => {
    expect(decideLanding(session({ memberships: [membership('chmi')] }), false)).toEqual({
      kind: 'enter',
      slug: 'chmi',
      reason: 'single',
    });
  });

  it('asks when there are several, an invitation, or the console', () => {
    expect(decideLanding(session({ memberships: [membership('a'), membership('b')] }), true)).toEqual({
      kind: 'choose',
    });
    expect(
      decideLanding(session({ memberships: [membership('a')], invitations: [{ slug: 'b' }] as never }), true),
    ).toEqual({ kind: 'choose' });
    expect(decideLanding(session({ memberships: [membership('a')], platform_admin: true }), true)).toEqual({
      kind: 'choose',
    });
  });
});
