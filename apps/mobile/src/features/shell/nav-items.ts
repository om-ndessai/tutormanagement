// Ported from NAV_ITEMS in apps/web/src/components/layout/app-shell.tsx @ 22b9701 (Phase 38 added
// `feature` and `badge`: the Assessment menu, in beta, only while the organization has it on; Phase 42
// @ 82397b8, working tree, added Quest, only while the organization has Question Quest on; Phase 47
// @ 9eccdf2, working tree, gave Quest the Beta badge; Phase 50 @ 2471d84, working tree, replaced
// `feature` with `set`: each item of a feature set shows only while that set is on here).
import type { Href } from 'expo-router';

import { featureOn, type FeatureSet, type FeatureState } from '@tmi/shared';

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
  /** Only for readers holding one of these roles here. */
  roles?: readonly string[];
  /**
   * Reached from the tab bar, so not listed under More: one of the tabs, or inside one (Schedule,
   * inside Sessions since the bar was revised on 2026-10-15).
   */
  tab?: boolean;
  /** The feature tour points at this (the web's data-tour="nav-…"). */
  tourId: string;
  /** Phase 50: the feature set it belongs to; shown only while that set is on here (`featureOn`). */
  set?: FeatureSet;
  /** A small label beside it, such as "Beta". */
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    // The Home tab. Called Home, as the tab bar calls it: "Dashboard" is the figures' own page now.
    href: '/dashboard',
    label: 'Home',
    icon: 'home-outline',
    keywords: ['home', 'overview', 'next lesson'],
    tab: true,
    tourId: 'nav-dashboard',
  },
  {
    href: '/sessions',
    set: 'tutoring',
    label: 'Sessions',
    icon: 'book-open-variant',
    keywords: ['lessons', 'record', 'notes', 'drafts'],
    tab: true,
    tourId: 'nav-sessions',
  },
  {
    href: '/schedule',
    set: 'tutoring',
    label: 'Schedule',
    icon: 'calendar-month-outline',
    keywords: ['calendar', 'cancel', 'weekly'],
    tab: true,
    tourId: 'nav-schedule',
  },
  {
    href: '/progress',
    set: 'tutoring',
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
    set: 'assessment',
    badge: 'Beta',
    tourId: 'nav-assessments',
  },
  {
    // Phase 42: Question Quest (gamification). Only while the organization has it on. In beta since
    // Phase 47, as on the web.
    href: '/quest',
    label: 'Quest',
    icon: 'trophy-outline',
    keywords: ['game', 'points', 'questions', 'approve', 'review'],
    set: 'quest',
    badge: 'Beta',
    tourId: 'nav-quest',
  },
  {
    // Phase 43 (the owner, 2026-10-20): the Analytics figures, which left Home. For the roles that
    // had them on Home: tutors and the office.
    href: '/analytics',
    set: 'tutoring',
    label: 'Dashboard',
    icon: 'view-dashboard-outline',
    keywords: ['analytics', 'figures', 'counts', 'stats', 'overview'],
    roles: ['admin', 'tutor'],
    tourId: 'nav-analytics',
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
    set: 'tutoring',
    label: 'Pairings',
    icon: 'link-variant',
    keywords: ['assignments', 'tutor', 'student'],
    tourId: 'nav-assignments',
  },
  {
    // Every tutor's and student's places (Phase 33): admins only.
    href: '/locations',
    set: 'tutoring',
    label: 'Locations',
    icon: 'map-marker-outline',
    keywords: ['places', 'rooms', 'address', 'online', 'reminder'],
    admin: true,
    tourId: 'nav-locations',
  },
  {
    href: '/billing',
    set: 'tutoring',
    label: 'Billing',
    icon: 'wallet-outline',
    keywords: ['payments', 'money', 'balances', '1099', 'tax'],
    tourId: 'nav-billing',
  },
  {
    href: '/comments',
    set: 'tutoring',
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
  organization: Partial<FeatureState> | null | undefined,
): NavItem[] {
  const admin = Boolean(roles?.includes('admin'));
  return NAV_ITEMS.filter(
    (item) =>
      (!item.admin || admin) &&
      (!item.roles || item.roles.some((role) => roles?.includes(role))) &&
      (!item.set || featureOn(organization, item.set)),
  );
}

/** The menu, less what this reader's roles do not reach. */
export function useNavItems(): NavItem[] {
  const { user, organization } = useAuth();
  return visibleNavItems(user?.roles, organization);
}
