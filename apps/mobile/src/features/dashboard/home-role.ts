// Which role's dashboard Home shows, chosen from the account sheet (UI upgrades U6: the role chips
// moved off Home). Home publishes the reader's own roles and the one on screen; the sheet reads
// them and hands a choice back, as the "view as" people sheet does (`view-as.ts`): the sheet is the
// focused route, so `router.setParams` from it would land on the sheet, not on Home.
import type { UserRole } from '@tmi/shared';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';

export interface HomeRole {
  /** The reader's roles in this organization. */
  roles: UserRole[];
  /** The role whose dashboard is on screen. */
  current: UserRole;
}

let state: HomeRole | null = null;
const stateListeners = new Set<() => void>();

/** Home says what it shows (null while it shows somebody else's, or is gone). */
export function publishHomeRole(next: HomeRole | null): void {
  const same =
    state === next ||
    (state !== null &&
      next !== null &&
      state.current === next.current &&
      state.roles.length === next.roles.length &&
      state.roles.every((role, index) => role === next.roles[index]));
  if (same) return;
  state = next;
  stateListeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** The account sheet's view of Home: null when there is nothing to choose. */
export function useHomeRole(): HomeRole | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

type ChoiceListener = (role: UserRole) => void;
const choiceListeners = new Set<ChoiceListener>();

/**
 * From the account sheet: close it, bring Home forward with the role in its params (a bare
 * navigate would clear them), and hand Home the role too, which sets its own params.
 */
export function chooseHomeRole(role: UserRole): void {
  if (router.canGoBack()) router.back();
  router.navigate({ pathname: '/dashboard', params: { role } });
  choiceListeners.forEach((listener) => listener(role));
}

/** Home's subscription to the sheet's choice; returns the unsubscribe function. */
export function onHomeRoleChosen(listener: ChoiceListener): () => void {
  choiceListeners.add(listener);
  return () => choiceListeners.delete(listener);
}
