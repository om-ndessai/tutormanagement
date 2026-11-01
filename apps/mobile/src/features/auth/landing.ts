import { decideLanding, type SessionResponse } from '@tmi/shared';

/**
 * Where a session lands, given what the server says. Ported from `applySession` in
 * apps/web/src/providers/auth-provider.tsx (Phase 60), as a pure function so it can be tested.
 *
 * - **A link** naming a space (`linked`, the developer link's `org`), if the person may enter it.
 * - **The app's own space** (`own`: chosen, switched to or landed in during this run) while the
 *   person may still enter it.
 * - Otherwise -- arriving (just launched or signed in), or the own space can no longer be
 *   entered -- **the landing rule** shared with the web (`decideLanding`, docs/spaces-plan.md S4):
 *   the last space the person opened on any device (`is_default`, the server's), then their only
 *   space when nothing is pending; otherwise the selector. The device's remembered last space
 *   (`tmi.lastOrg`) never outranks the server's choice: it only names the first request's space.
 *
 * `in` means the session already reads inside that space; `enter` means: set this space and read
 * the session again inside it; `choose` means the selector (the Spaces screen without the frame).
 */
export type Landing = { kind: 'in'; slug: string } | { kind: 'enter'; slug: string } | { kind: 'choose' };

export function landingFor(
  session: SessionResponse,
  { own, linked }: { own: string | null; linked: string | null },
): Landing {
  const here = session.organization?.slug ?? null;
  const enterable = (slug: string) => session.memberships.some((m) => m.slug === slug && m.status === 'active');

  let target: string | null;
  if (linked && enterable(linked)) target = linked;
  else if (own && own === here) target = own;
  else target = decideLanding(session);

  if (target && target === here) return { kind: 'in', slug: target };
  if (target) return { kind: 'enter', slug: target };
  return { kind: 'choose' };
}
