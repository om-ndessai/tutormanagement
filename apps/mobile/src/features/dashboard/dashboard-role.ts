// Phase 74 (JF24, docs/journey-fixes-plan.md; owner 2026-11-05): which role the Dashboard (More → Dashboard) opens on.
// The Home and the Dashboard once picked opposite hats -- Maria, a parent who also tutors and teaches nobody, landed on
// an empty Tutor view. Now, first to last: the link's `?role=`; the role last chosen in this space on this device; the
// role of the hat the member home leads with (`dashboardRoleForHat(orderHats(home)[0])`, from the home already read --
// never a second read); else the server's own default. Only a role the reader holds here counts.
import { dashboardRoleForHat, orderHats, USER_ROLES, type ApiOk, type MemberHome, type UserRole } from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { memberHomeKey } from '@/features/home/api';
import { readPref, STORAGE_KEYS, writePref } from '@/lib/storage';

/** The role to open on, when the link asks for none (undefined: the server's default). */
export function openingRole({
  remembered,
  home,
  roles,
}: {
  remembered: UserRole | null;
  home: MemberHome | null | undefined;
  roles: readonly UserRole[];
}): UserRole | undefined {
  if (remembered && roles.includes(remembered)) return remembered;
  const lead = home ? orderHats(home)[0] : undefined;
  const byHat = lead ? dashboardRoleForHat(lead) : null;
  if (byHat && roles.includes(byHat)) return byHat;
  return undefined;
}

const KEEP = 20;

function parse(raw: string | null): Record<string, string> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const asRole = (value: string | undefined): UserRole | null => USER_ROLES.find((role) => role === value) ?? null;

/** The role last chosen in this space on this device, or null. */
export async function readRememberedRole(slug: string): Promise<UserRole | null> {
  return asRole(parse(await readPref(STORAGE_KEYS.dashboardRole))[slug]);
}

/** Remembers a choice for this space (a preference: the slug and the role only). */
export async function writeRememberedRole(slug: string, role: UserRole): Promise<void> {
  const map = parse(await readPref(STORAGE_KEYS.dashboardRole));
  delete map[slug];
  const entries = [...Object.entries(map), [slug, role] as const].slice(-KEEP);
  await writePref(STORAGE_KEYS.dashboardRole, JSON.stringify(Object.fromEntries(entries)));
}

/**
 * The Dashboard's opening role, decided once when the page opens (a background read of the home never moves it), and
 * how to remember a choice. `ready` is false until the device's memory has been read.
 */
export function useOpeningDashboardRole(
  slug: string | undefined,
  roles: readonly UserRole[] | undefined,
): { ready: boolean; role: UserRole | undefined; remember: (role: UserRole) => Promise<void> } {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ ready: boolean; role: UserRole | undefined }>({ ready: false, role: undefined });
  useEffect(() => {
    let cancelled = false;
    void readRememberedRole(slug ?? '').then((remembered) => {
      if (cancelled) return;
      const home = queryClient.getQueryData<ApiOk<MemberHome>>(memberHomeKey)?.data;
      setState({ ready: true, role: openingRole({ remembered, home, roles: roles ?? [] }) });
    });
    return () => {
      cancelled = true;
    };
  }, [slug, roles, queryClient]);
  // A choice is this page's role from now on too: after "Back to mine" (or any return to one's own view without a
  // `?role=`), the page shows the role just chosen, not the one it opened on.
  const remember = useCallback(
    async (role: UserRole) => {
      setState((current) => ({ ...current, role }));
      await writeRememberedRole(slug ?? '', role);
    },
    [slug],
  );
  return { ...state, remember };
}
