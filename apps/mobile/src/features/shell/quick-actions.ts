// Home-screen quick actions (ux-audit F-17, #43): long-press the app icon for "Start a lesson" or
// "Record a lesson". A system surface, so generic verbs only: no student, no organization, no money
// (immersive-design.md §0.4). Set per organization from the roles held THERE, and cleared on
// sign-out (§0.7). An action is only a route: the role is checked again on arrival, and the
// server checks again after that.
import type { UserRole as Role } from '@tmi/shared';
import { router } from 'expo-router';
import * as QuickActions from 'expo-quick-actions';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type QuickActionId = 'start-lesson' | 'record-session';

export interface QuickActionItem {
  id: QuickActionId;
  title: string;
  icon?: string;
}

const ITEMS: Record<QuickActionId, QuickActionItem> = {
  'start-lesson': { id: 'start-lesson', title: 'Start a lesson', icon: 'symbol:play.circle' },
  'record-session': { id: 'record-session', title: 'Record a lesson', icon: 'symbol:square.and.pencil' },
};

/** Only someone who teaches in this organization gets them. */
export function quickActionItems(roles: readonly Role[] | undefined): QuickActionItem[] {
  if (!roles?.includes('tutor')) return [];
  return [ITEMS['start-lesson'], ITEMS['record-session']];
}

/** Where an action leads, or null when the reader may not take it here. */
export function quickActionRoute(
  id: string | undefined,
  roles: readonly Role[] | undefined,
): '/start-lesson' | '/record-lesson' | null {
  if (!roles?.includes('tutor')) return null;
  if (id === 'start-lesson') return '/start-lesson';
  // The record step flow (UI upgrades U4); the action's id stays, as phones have it set.
  if (id === 'record-session') return '/record-lesson';
  return null;
}

function setItems(items: QuickActionItem[]) {
  // SF Symbols are iOS only; Android shows the app's icon.
  const native = items.map(({ id, title, icon }) => ({
    id,
    title,
    icon: Platform.OS === 'ios' ? icon : null,
  }));
  QuickActions.setItems(native).catch(() => {
    // A device without quick actions, or the app between activities: nothing to set.
  });
}

/** Removes them: on sign-out, so a shared phone offers nothing of the last person's. */
export function clearQuickActions() {
  setItems([]);
}

/** In the organization's layout: the items follow the roles held in this organization. */
export function useQuickActionItems(roles: readonly Role[] | undefined) {
  const key = quickActionItems(roles)
    .map((item) => item.id)
    .join(',');
  useEffect(() => {
    setItems(quickActionItems(roles));
    // `key` is what matters; the roles array is a new one on every session read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/**
 * The action that launched the app, if it has not been handled yet.
 *
 * iOS (patched, patches/expo-quick-actions+6.0.2.patch): `getInitial()` hands it over once and
 * forgets it. Under the UIScene life cycle a cold-start action arrives after the module's `initial`
 * constant is fixed, so the constant alone loses it. Android, and an unpatched binary: the
 * `initial` constant, taken once per process so an organization switch's remount does not replay it.
 */
let launchHandled = false;
function takeLaunchAction(): { id?: string } | null {
  const native = (
    globalThis as {
      expo?: { modules?: { ExpoQuickActions?: { getInitial?: () => { id?: string } | null } } };
    }
  ).expo?.modules?.ExpoQuickActions;
  if (typeof native?.getInitial === 'function') return native.getInitial();
  if (launchHandled) return null;
  launchHandled = true;
  return QuickActions.initial ?? null;
}

/** In the organization's layout: opens the sheet an action names, if the reader may use it here. */
export function useQuickActionHandler(roles: readonly Role[] | undefined) {
  const rolesRef = useRef(roles);
  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  useEffect(() => {
    const open = (action: { id?: string } | null | undefined) => {
      const route = quickActionRoute(action?.id, rolesRef.current);
      // After the layout's first frame, so the stack is there to push onto.
      if (route) setTimeout(() => router.navigate(route), 0);
    };
    open(takeLaunchAction());
    const subscription = QuickActions.addListener(open);
    return () => subscription.remove();
  }, []);
}
