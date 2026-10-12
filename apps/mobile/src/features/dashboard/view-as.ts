// The dashboard's subject and role live in Home's params, as the web keeps them in the URL
// (`/dashboard?as=<userId>&role=<role>&tab=finance`), so a view survives and can be linked to.
import type { UserRole } from '@tmi/shared';
import { router } from 'expo-router';

export interface DashboardParams {
  as?: string;
  role?: UserRole;
  tab?: 'finance';
}

/**
 * Looks at a person's dashboard, from Home itself (a Finance row). Changing who is viewed clears
 * the chosen role, as on the web, unless one is given.
 */
export function viewAs(userId: string, role?: UserRole, tab?: 'finance'): void {
  router.setParams({ as: userId, role, tab });
}

/** Back to the reader's own dashboard. */
export function backToMine(): void {
  router.setParams({ as: undefined, role: undefined, tab: undefined });
}

type SubjectListener = (userId: string | null) => void;
const subjectListeners = new Set<SubjectListener>();

/**
 * From the people sheet, which sits over Home: close it and hand the choice to Home, which sets
 * its own params (`router.setParams` would land on the sheet, the focused route, and a pop with
 * params does not reach into the tab's stack).
 */
export function chooseFromSheet(userId: string | null): void {
  if (router.canGoBack()) router.back();
  subjectListeners.forEach((listener) => listener(userId));
}

/** Home's subscription to the sheet's choice; returns the unsubscribe function. */
export function onSubjectChosen(listener: SubjectListener): () => void {
  subjectListeners.add(listener);
  return () => subjectListeners.delete(listener);
}
