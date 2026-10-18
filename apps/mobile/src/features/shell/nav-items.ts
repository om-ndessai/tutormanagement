// Ported from NAV_ITEMS in apps/web/src/components/layout/app-shell.tsx @ 22b9701 (Phase 38 added
// `feature` and `badge`: the Assessment menu, in beta, only while the organization has it on).
import type { Href } from 'expo-router';

import type { Organization } from '@tmi/shared';

import { useAuth } from '@/providers/auth-provider';

/**
 * Every page of the portal, as the web sidebar lists them. On the phone the first four are
 * reached from the tab bar (Home, Sessions and Progress are tabs; Schedule is inside Sessions --
 * the same for everyone, so the bar never reshapes under someone); the rest are reached from More
 * and the search screen. The server decides what each page shows the
 * reader -- the menu only leaves out what their roles cannot open at all (Locations, Organization).
 */
export interface NavItem {
  href: Href;
  label: string;
  /** Material Community icon name (Paper). */
  icon: string;
  keywords: string[];
  admin?: boolean;
  /**
   * Reached from the tab bar, so not listed under More: one of the tabs, or inside one (Schedule,
   * inside Sessions since the bar was revised on 2026-10-15).
   */
  tab?: boolean;
  /** The feature tour points at this (the web's data-tour="nav-…"). */
  tourId: string;
  /** Shown only while the organization has this switched on. */
  feature?: 'canvas_assessments';
  /** A small label beside it, such as "Beta". */
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: 'view-dashboard-outline',
    keywords: ['home', 'overview'],
    tab: true,
    tourId: 'nav-dashboard',
  },
  {
    href: '/sessions',
    label: 'Sessions',
    icon: 'book-open-variant',
    keywords: ['lessons', 'record', 'notes', 'drafts'],
    tab: true,
    tourId: 'nav-sessions',
  },
  {
    href: '/schedule',
    label: 'Schedule',
    icon: 'calendar-month-outline',
    keywords: ['calendar', 'cancel', 'weekly'],
    tab: true,
    tourId: 'nav-schedule',
  },
  {
    href: '/progress',
    label: 'Progress',
    icon: 'trending-up',
    keywords: ['plans', 'assessments', 'goals'],
    tab: true,
    tourId: 'nav-progress',
  },
  {
    // Phase 38, in beta: answers written on a canvas. Only while the organization has it on.
    href: '/assessments',
    label: 'Assessment',
    icon: 'draw-pen',
    keywords: ['test', 'quiz', 'canvas', 'handwriting', 'questions'],
    feature: 'canvas_assessments',
    badge: 'Beta',
    tourId: 'nav-assessments',
  },
  {
    href: '/people',
    label: 'Users',
    icon: 'account-group-outline',
    keywords: ['people', 'students', 'tutors', 'parents', 'family'],
    tourId: 'nav-users',
  },
  {
    href: '/pairings',
    label: 'Pairings',
    icon: 'link-variant',
    keywords: ['assignments', 'tutor', 'student'],
    tourId: 'nav-assignments',
  },
  {
    // Every tutor's and student's places (Phase 33): admins only.
    href: '/locations',
    label: 'Locations',
    icon: 'map-marker-outline',
    keywords: ['places', 'rooms', 'address', 'online', 'reminder'],
    admin: true,
    tourId: 'nav-locations',
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: 'wallet-outline',
    keywords: ['payments', 'money', 'balances', '1099', 'tax'],
    tourId: 'nav-billing',
  },
  {
    href: '/comments',
    label: 'Comments',
    icon: 'message-text-outline',
    keywords: ['notes', 'messages'],
    tourId: 'nav-comments',
  },
  {
    href: '/activity',
    label: 'Activity',
    icon: 'history',
    keywords: ['log', 'audit', 'history'],
    tourId: 'nav-activity',
  },
  {
    href: '/profile',
    label: 'My profile',
    icon: 'account-outline',
    keywords: ['me', 'account'],
    tourId: 'nav-profile',
  },
  {
    href: '/organization',
    label: 'Organization',
    icon: 'domain',
    keywords: ['settings', 'tin', 'payer'],
    admin: true,
    tourId: 'nav-organization',
  },
];

/** The menu, less what this reader's roles do not reach and what the organization has off. */
export function visibleNavItems(
  roles: readonly string[] | undefined,
  organization: Pick<Organization, 'canvas_assessments'> | null | undefined,
): NavItem[] {
  const admin = Boolean(roles?.includes('admin'));
  return NAV_ITEMS.filter(
    (item) => (!item.admin || admin) && (!item.feature || Boolean(organization?.[item.feature])),
  );
}

/** The menu, less what this reader's roles do not reach. */
export function useNavItems(): NavItem[] {
  const { user, organization } = useAuth();
  return visibleNavItems(user?.roles, organization);
}
