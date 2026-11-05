// Phase 63 (P10): what a guest's phone remembers -- read once from AsyncStorage, written through on every
// change, never sent -- and the quest in progress, kept for the run.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { STORAGE_KEYS } from '@/lib/storage';
import type { GuestQuestState } from './guest-model';
import * as guestStore from './guest-store';

beforeEach(async () => {
  await AsyncStorage.clear();
  guestStore.resetGuestMemoryForTests();
});

/** A fresh run: nothing read yet. */
async function freshStore() {
  return guestStore;
}

describe('the guest’s memory (P10)', () => {
  it('reads what the phone kept, once', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.guest,
      JSON.stringify({ grade: 'NC26.3', seen: { 'NC26.3': ['a'] }, best: { G3Q5: 4 } }),
    );
    const store = await freshStore();
    await store.loadGuestMemory();
    expect(store.guestMemory.grade()).toBe('NC26.3');
    expect([...store.guestMemory.seen('NC26.3')]).toEqual(['a']);
    expect(store.guestMemory.best('G3Q5')).toBe(4);
    expect(store.guestMemory.best('G4Q5')).toBeUndefined();
  });

  it('forgives a memory it cannot read', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.guest, '{not json');
    const store = await freshStore();
    await store.loadGuestMemory();
    expect(store.guestMemory.grade()).toBeUndefined();
  });

  it('writes every change through: seen ids once each, the best score kept, the last 12 tiles', async () => {
    const store = await freshStore();
    await store.loadGuestMemory();
    store.guestMemory.setGrade('NC26.4');
    store.guestMemory.addSeen('NC26.4', ['a', 'b']);
    store.guestMemory.addSeen('NC26.4', ['b', 'c']);
    store.guestMemory.setBest('G4Q5', 3);
    store.guestMemory.setBest('G4Q5', 2);
    for (let i = 0; i < 14; i += 1) store.guestMemory.addPlayed(`G4Q${i}`);
    store.guestMemory.addPlayed('G4Q3');
    store.guestMemory.dismissNudge(123);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const kept = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.guest))!);
    expect(kept.grade).toBe('NC26.4');
    expect(kept.seen['NC26.4']).toEqual(['a', 'b', 'c']);
    expect(kept.best.G4Q5).toBe(3);
    expect(kept.played).toHaveLength(12);
    expect(kept.played[0]).toBe('G4Q3');
    expect(kept.nudgeDismissedAt).toBe(123);
  });

  it('keeps one quest in progress for the run, by its tile', async () => {
    const store = await freshStore();
    const state: GuestQuestState = {
      code: 'G4Q5',
      questionIds: ['a'],
      answers: [],
      startedAt: 1,
      pausedMs: 0,
      pausedAt: null,
      nudged: false,
    };
    store.writeQuestState(state);
    expect(store.readQuestState('G4Q5')).toBe(state);
    expect(store.readQuestState('G4T10')).toBeNull();
    store.writeQuestState(null);
    expect(store.readQuestState('G4Q5')).toBeNull();
  });
});

describe('the guest’s grade, carried to the member’s Play home (P13)', () => {
  it('is the grade chosen, else the level of the tile played last, else none', () => {
    guestStore.resetGuestMemoryForTests({});
    expect(guestStore.guestLeadLevel()).toBeNull();
    guestStore.resetGuestMemoryForTests({ played: ['BA3Q5', 'G4Q5'] });
    expect(guestStore.guestLeadLevel()).toBe('BA3');
    guestStore.resetGuestMemoryForTests({ grade: 'NC26.6', played: ['BA3Q5'] });
    expect(guestStore.guestLeadLevel()).toBe('NC26.6');
  });
});

describe('the tiles a guest played, carried into favorites once (P13)', () => {
  it('offers each played tile until it is marked carried, and keeps a tile played later', () => {
    guestStore.resetGuestMemoryForTests({ played: ['G4T10', 'BA3Q5'] });
    expect(guestStore.guestMemory.uncarried()).toEqual(['G4T10', 'BA3Q5']);
    guestStore.guestMemory.markCarried(['G4T10', 'BA3Q5']);
    expect(guestStore.guestMemory.uncarried()).toEqual([]);
    guestStore.guestMemory.addPlayed('G5Q5');
    expect(guestStore.guestMemory.uncarried()).toEqual(['G5Q5']);
  });
});

describe('addressKey: the one-way key an address is remembered by (UI audit JF8)', () => {
  it('is 32-bit FNV-1a, as eight hex digits', () => {
    // The published FNV-1a test vectors.
    expect(guestStore.addressKey('')).toBe('811c9dc5');
    expect(guestStore.addressKey('a')).toBe('e40c292c');
    expect(guestStore.addressKey('foobar')).toBe('bf9cf968');
  });

  it('ignores case and surrounding space, and is never the address itself', () => {
    const key = guestStore.addressKey('Mia.Lopez@Example.com ');
    expect(key).toBe(guestStore.addressKey('mia.lopez@example.com'));
    expect(key).toMatch(/^[0-9a-f]{8}$/);
    expect(key).not.toContain('mia');
    expect(guestStore.addressKey('dad.lopez@example.com')).not.toBe(key);
  });
});

describe('an under-13 refusal, remembered on this phone (owner, 2026-11-04)', () => {
  it('keeps the key only, most recent first, at most ten, each once', async () => {
    const store = await freshStore();
    await store.loadGuestMemory();
    for (let i = 0; i < 12; i += 1) store.guestMemory.rememberYoung(`kid${i}@example.com`);
    store.guestMemory.rememberYoung('kid5@example.com');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const raw = (await AsyncStorage.getItem(STORAGE_KEYS.guest))!;
    expect(raw).not.toContain('@example.com');
    const kept = JSON.parse(raw) as { tooYoung: string[] };
    expect(kept.tooYoung).toHaveLength(guestStore.TOO_YOUNG_KEPT);
    expect(kept.tooYoung[0]).toBe(guestStore.addressKey('kid5@example.com'));
    expect(new Set(kept.tooYoung).size).toBe(kept.tooYoung.length);
    expect(store.guestMemory.refusedYoung('KID11@example.com')).toBe(true);
    // The two oldest went.
    expect(store.guestMemory.refusedYoung('kid0@example.com')).toBe(false);
    expect(store.guestMemory.refusedYoung('kid1@example.com')).toBe(false);
  });

  it('knows nothing of an address it was not told, or of none', async () => {
    const store = await freshStore();
    await store.loadGuestMemory();
    store.guestMemory.rememberYoung('mia.lopez@example.com');
    expect(store.guestMemory.refusedYoung('mia.lopez@example.com')).toBe(true);
    expect(store.guestMemory.refusedYoung('parent.lopez@example.com')).toBe(false);
    expect(store.guestMemory.refusedYoung(null)).toBe(false);
    expect(store.guestMemory.refusedYoung('')).toBe(false);
    store.guestMemory.rememberYoung('  ');
    expect(store.guestMemory.refusedYoung('  ')).toBe(false);
  });

  it('is read with the rest of the phone’s memory, once loaded', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.guest,
      JSON.stringify({ tooYoung: [guestStore.addressKey('mia.lopez@example.com')] }),
    );
    const store = await freshStore();
    expect(store.guestMemoryReady()).toBe(false);
    await store.loadGuestMemory();
    expect(store.guestMemoryReady()).toBe(true);
    expect(store.guestMemory.refusedYoung('mia.lopez@example.com')).toBe(true);
  });
});

describe('a declined sign-up, for this run only (UI audit JF8)', () => {
  it('is remembered in memory, never written to the phone, and tells the screens once', async () => {
    const store = await freshStore();
    await store.loadGuestMemory();
    const { result } = await renderHook(() => store.useSignupDeclined());
    expect(result.current).toBe(false);
    await act(async () => store.declinedThisRun.mark());
    expect(result.current).toBe(true);
    expect(store.declinedThisRun.is()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(await AsyncStorage.getItem(STORAGE_KEYS.guest)).toBeNull();
  });
});
