// Home-screen quick actions (ux-audit F-17, #43): long-press the app icon for "Start a lesson" or
// "Record a lesson". A system surface, so generic verbs only: no student, no organization, no money
// (immersive-design.md §0.4). Set per organization from the roles held THERE, and cleared on
// sign-out (§0.7). An action is only a route: the role is checked again on arrival, and the
// server checks again after that. Phase 50: lessons are Tutoring's, so a space without it offers none.
//
// Phase 62 (P6): a quest from the icon, only where Quest is on. Phase 73 (JF13, owner 2026-11-05): it is
// Continue, from the server's open-game read as Home last had it (never read for the icon itself): with a game
// open, "Continue your game"; with none, the last game's settings again under their words ("Play Grade 7 Quick
// 5 again"), built from the settings alone -- never a favorite's typed name, a code, a person or a space.
import { featureOn, type FeatureState, type OpenGameResponse, type UserRole as Role } from '@tmi/shared';
import { router } from 'expo-router';
import * as QuickActions from 'expo-quick-actions';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export type QuickActionId = 'start-lesson' | 'record-session' | 'play-last';

export interface QuickActionItem {
  id: QuickActionId;
  title: string;
  icon?: string;
}

const ITEMS: Record<QuickActionId, QuickActionItem> = {
  'start-lesson': { id: 'start-lesson', title: 'Start a lesson', icon: 'symbol:play.circle' },
  'record-session': { id: 'record-session', title: 'Record a lesson', icon: 'symbol:square.and.pencil' },
  'play-last': { id: 'play-last', title: 'Play', icon: 'symbol:play.fill' },
};

type Org = Partial<FeatureState> | null | undefined;

/** The open game's or "again"'s words while Quest is on and Home has read one; otherwise none. */
export const CONTINUE_GAME_TITLE = 'Continue your game';

function playItem(organization: Org, open: OpenGameResponse | null | undefined): QuickActionItem[] {
  if (!open || !featureOn(organization, 'quest')) return [];
  if (open.open) return [{ ...ITEMS['play-last'], title: CONTINUE_GAME_TITLE }];
  if (open.again) return [{ ...ITEMS['play-last'], title: open.again.label }];
  return [];
}

/**
 * The lesson actions only for someone who teaches in this organization, and only where Tutoring is
 * on; Continue for anyone, where Quest is on, once Home has read their open game.
 */
export function quickActionItems(
  roles: readonly Role[] | undefined,
  organization: Org,
  open?: OpenGameResponse | null,
): QuickActionItem[] {
  const lessons =
    roles?.includes('tutor') && featureOn(organization, 'tutoring')
      ? [ITEMS['start-lesson'], ITEMS['record-session']]
      : [];
  return roles ? [...lessons, ...playItem(organization, open)] : [];
}

/** Where an action leads, or null when the reader may not take it here. */
export function quickActionRoute(
  id: string | undefined,
  roles: readonly Role[] | undefined,
  organization: Org,
): '/start-lesson' | '/record-lesson' | '/quest/play-last' | null {
  if (id === 'play-last') return roles && featureOn(organization, 'quest') ? '/quest/play-last' : null;
  if (!roles?.includes('tutor') || !featureOn(organization, 'tutoring')) return null;
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
export function useQuickActionItems(
  roles: readonly Role[] | undefined,
  organization: Org,
  open?: OpenGameResponse | null,
) {
  const items = quickActionItems(roles, organization, open);
  const key = items.map((item) => `${item.id}:${item.title}`).join(',');
  useEffect(() => {
    setItems(items);
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
export function useQuickActionHandler(roles: readonly Role[] | undefined, organization: Org) {
  const rolesRef = useRef(roles);
  const orgRef = useRef(organization);
  useEffect(() => {
    rolesRef.current = roles;
    orgRef.current = organization;
  }, [roles, organization]);

  useEffect(() => {
    const open = (action: { id?: string } | null | undefined) => {
      const route = quickActionRoute(action?.id, rolesRef.current, orgRef.current);
      // After the layout's first frame, so the stack is there to push onto.
      if (route) setTimeout(() => router.navigate(route), 0);
    };
    open(takeLaunchAction());
    const subscription = QuickActions.addListener(open);
    return () => subscription.remove();
  }, []);
}
