import type { SessionResponse } from '@tmi/shared';

/**
 * Where a session lands, given what the server says. Ported from `applySession` in
 * apps/web/src/providers/auth-provider.tsx @ 1132322, as a pure function so it can be tested.
 *
 * - An ARRIVING run (just launched, just signed in) lands in the person's default organization
 *   when they have one they may still enter -- ahead of the last organization this device used.
 * - Otherwise the organization the session is in (the one the request named) stands.
 * - Otherwise, with exactly one place to go and nothing else to decide, go straight in.
 * - Otherwise the picker asks.
 *
 * `enter` means: set this organization and read the session again inside it.
 */
export type Landing =
  | { kind: 'in'; slug: string }
  | { kind: 'enter'; slug: string; reason: 'default' | 'single' }
  | { kind: 'choose' };

export function decideLanding(session: SessionResponse, arriving: boolean): Landing {
  const preferred = session.memberships.find((m) => m.is_default && m.status === 'active');
  if (arriving && preferred && session.organization?.slug !== preferred.slug) {
    return { kind: 'enter', slug: preferred.slug, reason: 'default' };
  }
  if (session.organization) return { kind: 'in', slug: session.organization.slug };

  const active = session.memberships.filter((m) => m.status === 'active');
  if (active.length === 1 && session.invitations.length === 0 && !session.platform_admin) {
    return { kind: 'enter', slug: active[0]!.slug, reason: 'single' };
  }
  return { kind: 'choose' };
}
