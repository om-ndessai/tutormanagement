import type { SessionResponse } from '@tmi/shared';

import { landingFor } from './landing';

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
    account: null,
    join_requests: [],
    ...over,
  } as unknown as SessionResponse;
}

const org = (slug: string) => ({ slug }) as SessionResponse['organization'];
const arriving = { own: null, linked: null };

describe('landingFor (Phase 60, ported from the web applySession; the rule is decideLanding in shared)', () => {
  it('lands an arriving person in the last space they chose, ahead of the device’s remembered one', () => {
    // The first request named the device's last space (chmi); the server's choice is riverside.
    const s = session({
      organization: org('chmi'),
      memberships: [membership('chmi'), membership('riverside', { is_default: true })],
    });
    expect(landingFor(s, arriving)).toEqual({ kind: 'enter', slug: 'riverside' });
  });

  it('is in at once when the device’s space is also the last choice', () => {
    const s = session({
      organization: org('riverside'),
      memberships: [membership('chmi'), membership('riverside', { is_default: true })],
    });
    expect(landingFor(s, arriving)).toEqual({ kind: 'in', slug: 'riverside' });
  });

  it('does not land in the device’s remembered space without a last choice: the selector asks', () => {
    const s = session({ organization: org('chmi'), memberships: [membership('chmi'), membership('riverside')] });
    expect(landingFor(s, arriving)).toEqual({ kind: 'choose' });
  });

  it('keeps the space the app chose once it is no longer arriving', () => {
    const s = session({
      organization: org('chmi'),
      memberships: [membership('chmi'), membership('riverside', { is_default: true })],
    });
    expect(landingFor(s, { own: 'chmi', linked: null })).toEqual({ kind: 'in', slug: 'chmi' });
  });

  it('lands again by the rule when the app’s own space can no longer be entered', () => {
    const s = session({
      organization: null,
      memberships: [membership('chmi', { status: 'suspended' }), membership('riverside')],
    });
    expect(landingFor(s, { own: 'chmi', linked: null })).toEqual({ kind: 'enter', slug: 'riverside' });
  });

  it('enters a linked space ahead of the last choice, and passes over one they may not enter', () => {
    const s = session({ memberships: [membership('chmi'), membership('riverside', { is_default: true })] });
    expect(landingFor(s, { own: null, linked: 'chmi' })).toEqual({ kind: 'enter', slug: 'chmi' });
    expect(landingFor(session({ ...s, organization: org('chmi') }), { own: null, linked: 'chmi' })).toEqual({
      kind: 'in',
      slug: 'chmi',
    });
    expect(landingFor(s, { own: null, linked: 'elsewhere' })).toEqual({ kind: 'enter', slug: 'riverside' });
  });

  it('ignores a last choice the person may no longer enter', () => {
    const s = session({
      memberships: [membership('chmi'), membership('riverside', { is_default: true, status: 'suspended' })],
    });
    expect(landingFor(s, arriving)).toEqual({ kind: 'enter', slug: 'chmi' });
  });

  it('goes straight into a single space -- a platform admin too, since Phase 60', () => {
    expect(landingFor(session({ memberships: [membership('chmi')] }), arriving)).toEqual({ kind: 'enter', slug: 'chmi' });
    expect(landingFor(session({ memberships: [membership('chmi')], platform_admin: true }), arriving)).toEqual({
      kind: 'enter',
      slug: 'chmi',
    });
  });

  it('asks when there are several and no last choice, or an invitation waits', () => {
    expect(landingFor(session({ memberships: [membership('a'), membership('b')] }), arriving)).toEqual({ kind: 'choose' });
    expect(
      landingFor(session({ memberships: [membership('a')], invitations: [{ slug: 'b' }] as never }), arriving),
    ).toEqual({ kind: 'choose' });
    // Only an invitation: the selector, with nothing entered.
    expect(landingFor(session({ invitations: [{ slug: 'b' }] as never }), arriving)).toEqual({ kind: 'choose' });
  });

  it('a last choice outranks an invitation waiting (the banner says it)', () => {
    const s = session({ memberships: [membership('a', { is_default: true })], invitations: [{ slug: 'b' }] as never });
    expect(landingFor(s, arriving)).toEqual({ kind: 'enter', slug: 'a' });
  });

  it('waits on an open request to join rather than entering the one space (Phase 52)', () => {
    const s = session({ memberships: [membership('chmi')], join_requests: [{ slug: 'assess' }] as never });
    expect(landingFor(s, arriving)).toEqual({ kind: 'choose' });
  });

  it('a declined request (kept until seen) is answered, not pending: straight into the one space (S4 rule 3, S5)', () => {
    const s = session({
      memberships: [membership('a')],
      join_requests: [{ slug: 'b', outcome: 'declined', requested_at: '2026-10-30T10:00:00Z' }] as never,
    });
    expect(landingFor(s, arriving)).toEqual({ kind: 'enter', slug: 'a' });
    // An open one beside it still waits.
    const open = session({
      memberships: [membership('a')],
      join_requests: [
        { slug: 'b', outcome: 'declined', requested_at: '2026-10-30T10:00:00Z' },
        { slug: 'c', outcome: null, requested_at: '2026-10-30T11:00:00Z' },
      ] as never,
    });
    expect(landingFor(open, arriving)).toEqual({ kind: 'choose' });
  });

  it('lets a newcomer (no space at all) choose: the Welcome', () => {
    expect(landingFor(session({}), arriving)).toEqual({ kind: 'choose' });
  });
});
