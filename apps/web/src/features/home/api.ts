import { useQuery } from '@tanstack/react-query';
import type { ApiOk, MemberHome } from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

/** Phase 66 (H11): the member home in one read. Under ['home'], so recording or starting a lesson refreshes it. */
export const memberHomeKey = ['home', 'member'] as const;

export function useMemberHome() {
  return useQuery({
    queryKey: memberHomeKey,
    queryFn: () => apiClient.get<ApiOk<MemberHome>>('/home'),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** "Later" puts a Next up item off for the rest of the day, on this device. */
const laterKey = (space: string | undefined, day: string) => `aimtrue.home-later.${space ?? ''}.${day}`;

export function readPutOff(space: string | undefined, day: string): Set<string> {
  try {
    const raw = localStorage.getItem(laterKey(space, day));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function putOff(space: string | undefined, day: string, key: string): void {
  try {
    const now = readPutOff(space, day);
    now.add(key);
    localStorage.setItem(laterKey(space, day), JSON.stringify([...now]));
  } catch {
    // Storage blocked: "Later" lasts until the page is reloaded.
  }
}
