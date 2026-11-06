// Ported from NAV_ITEMS in apps/web/src/components/layout/app-shell.tsx @ 22b9701 (Phase 38 added
// `feature` and `badge`: the Assessment menu, in beta, only while the organization has it on; Phase 42
// @ 82397b8, working tree, added Quest, only while the organization has Question Quest on; Phase 47
// @ 9eccdf2, working tree, gave Quest the Beta badge, which Phase 78 took away again; Phase 50 @ 2471d84, working tree, replaced
// `feature` with `set`: each item of a feature set shows only while that set is on here). Phase 74 (JF31, owner
// 2026-11-05): Users, Pairings and Billing are for admins and tutors (`PEOPLE_PAGE_ROLES`, shared `seesPeoplePages`):
// a student or a parent never sees them in the menu (a parent reaches their child from the home's child card); the
// routes still answer a deep link.
import type { Href } from 'expo-router';

import { COMMON_COPY, featureOn, type FeatureSet, type FeatureState } from '@tmi/shared';

import { useAuth } from '@/providers/auth-provider';

/**
 * Every page of the portal, as the web sidebar lists them. On the phone the first four are
 * reached from the tab bar (Home, Sessions and Progress are tabs; Schedule is inside Sessions, and listed under More too --
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
   * One of the tab bar's tabs, so not listed under More. (Schedule, inside Sessions, is listed under
   * More as well, since 2026-10-28.)
   */
  tab?: boolean;
  /** The feature tour points at this (the web's data-tour="nav-…"). */
  tourId: string;
  /** Phase 50: the feature set it belongs to; shown only while that set is on here (`featureOn`). */
  set?: FeatureSet;
  /** A small label beside it. None carries one since Phase 78 ("Beta" went, owner 2026-11-05). */
  badge?: string;
}

/** Phase 74 (JF31): who sees the people pages in the menu -- the roles of shared `seesPeoplePages`. */
export const PEOPLE_PAGE_ROLES = ['admin', 'tutor'] as const;

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
    // Phase 78 (the glossary): the page says lessons; its route and testIDs keep their code names.
    label: COMMON_COPY.lessons_page,
    icon: 'book-open-variant',
    keywords: ['lessons', 'sessions', 'record', 'notes', 'drafts'],
    tab: true,
    tourId: 'nav-sessions',
  },
  {
    // Reached from Sessions (the Lessons | Schedule switch), and listed under More as well, so it
    // is in the menu as it is in the web sidebar (the owner, 2026-10-28).
    href: '/schedule',
    set: 'tutoring',
    label: 'Schedule',
    icon: 'calendar-month-outline',
    keywords: ['calendar', 'cancel', 'weekly'],
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
    // Phase 38: answers written on a canvas. Only while the organization has it on. (Its Beta badge went in Phase 78.)
    href: '/assessments',
    label: 'Assessment',
    icon: 'draw-pen',
    keywords: ['test', 'quiz', 'canvas', 'handwriting', 'questions'],
    set: 'assessment',
    tourId: 'nav-assessments',
  },
  {
    // Phase 42: Question Quest (gamification). Only while the organization has it on. (In beta from
    // Phase 47 to Phase 78, as on the web.)
    href: '/quest',
    label: 'Quest',
    icon: 'trophy-outline',
    keywords: ['game', 'points', 'questions', 'approve', 'review'],
    set: 'quest',
    tourId: 'nav-quest',
  },
  {
    // Phase 43 (the owner, 2026-10-20): the Analytics figures, which left Home. Since Phase 66 the whole
    // role dashboard (Tutoring and Finance, the admin's "view as"), for every role where Tutoring is on:
    // Home carries no money, so a parent's balances and a student's figures are here.
    href: '/analytics',
    set: 'tutoring',
    label: 'Dashboard',
    icon: 'view-dashboard-outline',
    keywords: ['analytics', 'figures', 'counts', 'stats', 'overview', 'balance', 'finance'],
    tourId: 'nav-analytics',
  },
  {
    href: '/people',
    label: COMMON_COPY.people_page,
    icon: 'account-group-outline',
    keywords: ['people', 'users', 'students', 'tutors', 'parents', 'family'],
    roles: PEOPLE_PAGE_ROLES,
    tourId: 'nav-users',
  },
  {
    href: '/pairings',
    set: 'tutoring',
    label: 'Pairings',
    icon: 'link-variant',
    keywords: ['assignments', 'tutor', 'student'],
    roles: PEOPLE_PAGE_ROLES,
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
    roles: PEOPLE_PAGE_ROLES,
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
    // "Space settings", not "Space": a teacher looking to start a space met this as a dead end (UI audit JF7).
    label: 'Space settings',
    icon: 'domain',
    keywords: ['settings', 'tin', 'payer', 'organization', 'code', 'join'],
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
