// Ported from NAV_ITEMS in apps/web/src/components/layout/app-shell.tsx @ 1132322
import type { Href } from 'expo-router';

import { useAuth } from '@/providers/auth-provider';

/**
 * Every page of the portal, as the web sidebar lists them. On the phone the first four are
 * tabs (the same four for everyone, so the tab bar never reshapes under someone); the rest
 * are reached from More and the search screen. The server decides what each page shows the
 * reader -- the menu only leaves out what their roles cannot open at all (Organization).
 */
export interface NavItem {
  href: Href;
  label: string;
  /** Material Community icon name (Paper). */
  icon: string;
  keywords: string[];
  admin?: boolean;
  /** One of the tabs. */
  tab?: boolean;
  /** The feature tour points at this (the web's data-tour="nav-…"). */
  tourId: string;
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

/** The menu, less what this reader's roles do not reach. */
export function useNavItems(): NavItem[] {
  const { user } = useAuth();
  const admin = Boolean(user?.roles.includes('admin'));
  return NAV_ITEMS.filter((item) => !item.admin || admin);
}
