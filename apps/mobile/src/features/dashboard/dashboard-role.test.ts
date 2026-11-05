// Phase 74 (JF24, owner 2026-11-05): the Dashboard opens on the link's role, else the one last chosen in this space on
// this phone, else the role of the hat the member home leads with, else the server's default -- only a role the reader
// holds here. Maria, a parent who also tutors and teaches nobody, opens on Parent (her home's hat), not an empty Tutor.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { MemberHome, UserRole } from '@tmi/shared';
import { createElement, type ReactNode } from 'react';

import { memberHomeKey } from '@/features/home/api';
import { INES, MARIA, PRIYA } from '@/features/home/member-home-fixtures';
import { openingRole, readRememberedRole, useOpeningDashboardRole, writeRememberedRole } from './dashboard-role';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('openingRole', () => {
  it('Maria (parent who tutors nobody): her home leads with the parent hat, so Parent', () => {
    expect(openingRole({ remembered: null, home: MARIA, roles: ['tutor', 'parent'] })).toBe('parent');
  });

  it("Priya: the office's lessons to record lead her home today, so Admin; a pinned Teaching home, Tutor", () => {
    expect(openingRole({ remembered: null, home: PRIYA, roles: ['admin', 'tutor'] })).toBe('admin');
    const pinned: MemberHome = { ...PRIYA, focus: 'tutoring', pin: 'tutoring' };
    expect(openingRole({ remembered: null, home: pinned, roles: ['admin', 'tutor'] })).toBe('tutor');
  });

  it('the last choice in this space wins over the hat, if it is still a role held here', () => {
    expect(openingRole({ remembered: 'tutor', home: MARIA, roles: ['tutor', 'parent'] })).toBe('tutor');
    expect(openingRole({ remembered: 'admin', home: MARIA, roles: ['tutor', 'parent'] })).toBe('parent');
  });

  it("with no home read, or a hat whose role is not held, the server's default (undefined)", () => {
    expect(openingRole({ remembered: null, home: undefined, roles: ['admin', 'tutor'] })).toBeUndefined();
    // A learner hat for someone who is not a student here (playing in a space without Tutoring).
    const playing: MemberHome = { ...INES, hats: ['learner'] };
    expect(openingRole({ remembered: null, home: playing, roles: ['admin'] })).toBeUndefined();
  });
});

describe('the choice, remembered per space on the device', () => {
  it('reads back what was chosen, per space; nothing else', async () => {
    expect(await readRememberedRole('chmi')).toBeNull();
    await writeRememberedRole('chmi', 'tutor');
    await writeRememberedRole('riverside', 'parent');
    expect(await readRememberedRole('chmi')).toBe('tutor');
    expect(await readRememberedRole('riverside')).toBe('parent');
    await writeRememberedRole('chmi', 'parent');
    expect(await readRememberedRole('chmi')).toBe('parent');
    expect(JSON.parse((await AsyncStorage.getItem('tmi.dashboardRole'))!)).toEqual({ riverside: 'parent', chmi: 'parent' });
  });

  it('ignores a stored value that is not a role, and keeps the last 20 spaces', async () => {
    await AsyncStorage.setItem('tmi.dashboardRole', JSON.stringify({ chmi: 'owner' }));
    expect(await readRememberedRole('chmi')).toBeNull();
    await AsyncStorage.setItem('tmi.dashboardRole', 'not json');
    expect(await readRememberedRole('chmi')).toBeNull();
    for (let i = 0; i < 25; i += 1) await writeRememberedRole(`space-${i}`, 'tutor');
    const kept = Object.keys(JSON.parse((await AsyncStorage.getItem('tmi.dashboardRole'))!));
    expect(kept).toHaveLength(20);
    expect(kept[0]).toBe('space-5');
    expect(kept.at(-1)).toBe('space-24');
  });
});

describe('useOpeningDashboardRole', () => {
  const MARIA_ROLES: UserRole[] = ['tutor', 'parent'];

  // No garbage-collection timer, so nothing outlives the test.
  const clients: QueryClient[] = [];
  afterEach(() => clients.splice(0).forEach((client) => client.clear()));

  async function open(home: MemberHome | null) {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    clients.push(client);
    if (home) client.setQueryData(memberHomeKey, { data: home });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
    const hook = await renderHook(() => useOpeningDashboardRole('chmi', MARIA_ROLES), { wrapper });
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    return hook;
  }

  it('waits for the phone’s memory, then opens Maria on the hat her home leads with', async () => {
    const { result, unmount } = await open(MARIA);
    expect(result.current).toMatchObject({ ready: true, role: 'parent' });
    await unmount();
  });

  it('a choice is remembered for this space, and the next opening starts there', async () => {
    const first = await open(MARIA);
    await first.result.current.remember('tutor');
    await first.unmount();
    const again = await open(MARIA);
    expect(again.result.current.role).toBe('tutor');
    await again.unmount();
  });

  it("with no home read yet, the server's default", async () => {
    const { result, unmount } = await open(null);
    expect(result.current).toMatchObject({ ready: true, role: undefined });
    await unmount();
  });
});
