// Ported from apps/web/src/features/onboarding/tour-steps.ts @ 1132322. The steps and their copy are
// the web's; only "Getting started" says where the phone keeps it (the account menu), and
// `placementOf` says where each target is on a phone: a registered view, or a tab of the tab bar
// (the menu items the tab bar has no room for live under More).
// Phase 43 (app-first, 2026-10-20): Home lost Analytics and Recent Activity, so the figures' step
// lights the Dashboard page under More and the Recent Activity step is gone; the web's tour follows
// when its half of the phase is built.
// Phase 50: the tour follows the feature sets (`tourStepsFor`): a menu step whose page is not on
// here is dropped, a space without Tutoring gets the space home's own steps, and the tab a step
// points at is found among the tabs the bar shows here.
import { featureOn, type FeatureState, type UserRole } from '@tmi/shared';

import { visibleNavItems } from '@/features/shell/nav-items';
import type { TabName } from '@/features/shell/app-tab-bar';

/**
 * One stop on the feature tour: what it points at (a `data-tour` attribute)
 * and what it says. A step whose target is not on screen is skipped -- a
 * menu item hidden behind the phone's menu button points at that button.
 */
export interface TourStep {
  target: string;
  title: string;
  body: string;
}

/**
 * The tour for each dashboard, in the order a newcomer needs it: the
 * dashboard's own sections first, then the menu. Copy speaks of "the office"
 * and never names the institute -- the same build serves the demo too.
 */
export const TOUR_STEPS: Record<UserRole, TourStep[]> = {
  admin: [
    {
      // Phase 43: the figures left Home for the Dashboard page, under More.
      target: 'nav-analytics',
      title: 'The institute at a glance',
      body: 'Students, tutors, parents and lessons, counted. Each card opens the list behind it.',
    },
    {
      target: 'dash-sessions',
      title: 'Lessons, past and coming',
      body: 'The last five lessons, then what the schedules say is next. A cancelled date shows here too.',
    },
    {
      target: 'dash-progress',
      title: 'Progress towards each goal',
      body: 'A few students with their timeline against the plan. All Progress has everyone.',
    },
    {
      target: 'tabs',
      title: 'Tutoring and Finance',
      body: 'Teaching lives on Tutoring, which shows no money. Charges, pay, balances and year-end are on Finance.',
    },
    {
      target: 'nav-users',
      title: 'Users',
      body: 'Everyone, once: one person can be a parent, a tutor and an admin. Add families and tutors here.',
    },
    {
      target: 'nav-assignments',
      title: 'Pairings',
      body: 'Which tutor teaches which student, and at what rate. A lesson needs a pairing.',
    },
    {
      target: 'nav-sessions',
      title: 'Sessions',
      body: 'Every lesson: timed live or written up afterwards, with notes, homework, reflections and drafts.',
    },
    {
      target: 'nav-progress',
      title: 'Progress',
      body: 'Assessments, learning plans and how each lesson moved a student towards the goal.',
    },
    {
      target: 'nav-schedule',
      title: 'Schedule',
      body: 'Standing weekly lessons and calendar files. Any single date can be cancelled and restored.',
    },
    {
      target: 'nav-billing',
      title: 'Billing',
      body: 'Payments in and out, balances, tutor advances and 1099s.',
    },
    {
      target: 'nav-comments',
      title: 'Comments',
      body: 'Notes on a person, a lesson, a pairing or a slot — read only by the people it concerns.',
    },
    {
      target: 'nav-activity',
      title: 'Activity',
      body: 'The audit log: who did what, and when.',
    },
    {
      target: 'getting-started',
      title: 'Come back any time',
      body: 'Take the tour, in your account menu, reopens this tour and the guided setup for a new student or tutor.',
    },
  ],
  tutor: [
    {
      target: 'nav-analytics',
      title: 'Your teaching at a glance',
      body: 'Your students, your lessons, and whether one is running now.',
    },
    {
      target: 'dash-sessions',
      title: 'Your lessons',
      body: 'Your last five lessons, then your next ones from the schedule — cancelled dates included.',
    },
    {
      target: 'dash-reflections',
      title: 'What your students said',
      body: 'Each student’s reflection on a lesson, with a flag when it was too fast, too hard or not new.',
    },
    {
      target: 'dash-progress',
      title: 'Progress',
      body: 'A few of your students against their learning plans.',
    },
    {
      target: 'tabs',
      title: 'Tutoring and Finance',
      body: 'Tutoring shows no money, so it is safe with a student beside you. Your pay is on Finance.',
    },
    {
      target: 'nav-sessions',
      title: 'Sessions',
      body: 'Start a live lesson, or record one afterwards: notes, homework, progress and your assessment. Save a draft if you are not done.',
    },
    {
      target: 'nav-schedule',
      title: 'Schedule',
      body: 'Your weekly slots and calendar files. Cancel a single date — a sick day — without touching the rest.',
    },
    {
      target: 'nav-billing',
      title: 'Billing',
      body: 'What you have been paid and what you are owed.',
    },
    {
      target: 'nav-comments',
      title: 'Comments',
      body: 'Notes with families and the office, on a lesson or a slot.',
    },
    {
      target: 'nav-profile',
      title: 'Your profile',
      body: 'How the office has you on file. Only the office can change it.',
    },
  ],
  parent: [
    {
      target: 'dash-children',
      title: 'Your children',
      body: 'Each child, their lessons and their balance.',
    },
    {
      target: 'dash-reflect',
      title: 'Reflect together',
      body: 'After a lesson, a few quick questions answered with your child. Their tutor reads them.',
    },
    {
      target: 'dash-child-progress',
      title: 'Progress',
      body: 'Where your child is against their goal, lesson by lesson.',
    },
    {
      target: 'dash-recent-sessions',
      title: 'Recent lessons',
      body: 'The latest lessons. The Sessions page has the notes and the homework.',
    },
    {
      target: 'nav-sessions',
      title: 'Sessions',
      body: 'Every lesson with its notes, homework, reflections and assessments.',
    },
    {
      target: 'nav-schedule',
      title: 'Schedule',
      body: 'Weekly lessons and calendar files. Away one week? Cancel just that date.',
    },
    {
      target: 'nav-billing',
      title: 'Billing',
      body: 'What each lesson costs, what you have paid, and what is outstanding.',
    },
    {
      target: 'nav-comments',
      title: 'Comments',
      body: 'Notes with the tutor and the office.',
    },
    {
      target: 'nav-profile',
      title: 'Your profile',
      body: 'How the office has you on file. Only the office can change it.',
    },
  ],
  student: [
    {
      target: 'dash-my-stats',
      title: 'Your lessons at a glance',
      body: 'How many lessons you have had, and with whom.',
    },
    {
      target: 'dash-reflect',
      title: 'How did it go?',
      body: 'After each lesson, a few quick questions. Your tutor reads your answers.',
    },
    {
      target: 'dash-my-progress',
      title: 'Your progress',
      body: 'Where you are against your goal, lesson by lesson.',
    },
    {
      target: 'dash-my-sessions',
      title: 'Your lessons',
      body: 'Your recent lessons. The Sessions page has the notes and the homework.',
    },
    {
      target: 'nav-sessions',
      title: 'Sessions',
      body: 'Every lesson, with its notes and homework — and where you reflect on it.',
    },
    {
      target: 'nav-schedule',
      title: 'Schedule',
      body: 'Your weekly lessons, to add to your calendar.',
    },
    {
      target: 'nav-progress',
      title: 'Progress',
      body: 'Your plan and the topics on it.',
    },
    {
      target: 'nav-profile',
      title: 'Your profile',
      body: 'How the office has you on file. Only the office can change it.',
    },
  ],
};

/**
 * Phase 50: the tour of a space without Tutoring, for its home (the Assessment home) and its menu.
 * Steps whose page is not on here are dropped by `tourStepsFor`, as are panels not on screen.
 */
const ASSESS_STUDENTS_STEP: TourStep = {
  target: 'dash-assess-students',
  title: 'Students',
  body: 'Each student and their latest assessment. Start one, or continue one in progress, from here.',
};
const NAV_ASSESSMENTS_STEP: TourStep = {
  target: 'nav-assessments',
  title: 'Assessment',
  body: 'Assessments answered by hand, one question a page, with a PDF for whoever reviews them.',
};
const NAV_QUEST_STEP: TourStep = {
  target: 'nav-quest',
  title: 'Quest',
  body: 'Question Quest and Quest Games: questions one at a time, for points.',
};
const NAV_PROFILE_STEP: TourStep = {
  target: 'nav-profile',
  title: 'Your profile',
  body: 'How the office has you on file. Only the office can change it.',
};

export const SPACE_TOUR_STEPS: Record<UserRole, TourStep[]> = {
  admin: [
    ASSESS_STUDENTS_STEP,
    {
      target: 'dash-assess-waiting',
      title: 'Waiting for review',
      body: 'Submitted assessments nobody has reviewed yet, oldest first.',
    },
    NAV_ASSESSMENTS_STEP,
    NAV_QUEST_STEP,
    {
      target: 'nav-users',
      title: 'Users',
      body: 'Everyone, once: one person can be a parent and an admin. Add families here.',
    },
    { target: 'nav-activity', title: 'Activity', body: 'The audit log: who did what, and when.' },
    {
      target: 'nav-organization',
      title: 'Space',
      body: 'What is switched on here, the curricula offered, and email notifications.',
    },
    {
      target: 'getting-started',
      title: 'Come back any time',
      body: 'Take the tour, in your account menu, reopens this tour and the guided setup for a new student.',
    },
  ],
  parent: [
    {
      target: 'dash-assess-students',
      title: 'Your children',
      body: 'Each child and their latest assessment. Start one, or continue one in progress, from here.',
    },
    {
      target: 'dash-assess-recent',
      title: 'Recent assessments',
      body: 'The latest assessments. A reviewed one opens as a PDF.',
    },
    NAV_ASSESSMENTS_STEP,
    NAV_PROFILE_STEP,
  ],
  student: [
    {
      target: 'dash-assess-students',
      title: 'Your assessments',
      body: 'Your latest assessment. Start one, or continue one in progress, from here.',
    },
    NAV_ASSESSMENTS_STEP,
    NAV_QUEST_STEP,
    NAV_PROFILE_STEP,
  ],
  // A tutor role kept in a space without Tutoring: the students' list, with the office's wording.
  tutor: [ASSESS_STUDENTS_STEP, NAV_ASSESSMENTS_STEP, NAV_QUEST_STEP, NAV_PROFILE_STEP],
};

/**
 * The tour for this role here: the Tutoring tour where Tutoring is on, the space's own otherwise,
 * less any menu step whose page is not in the menu here.
 */
export function tourStepsFor(role: UserRole, organization: Partial<FeatureState> | null | undefined): TourStep[] {
  const steps = featureOn(organization, 'tutoring') ? TOUR_STEPS[role] : SPACE_TOUR_STEPS[role];
  const menu = new Set(visibleNavItems([role], organization).map((item) => item.tourId));
  return steps.filter((step) => !step.target.startsWith('nav-') || menu.has(step.target));
}

/**
 * The tab bar, in its order (`features/shell/app-tab-bar.tsx`): Home, Sessions, Progress, More,
 * the "+" not counted -- or Home and More where Tutoring is off (`visibleTabs`). Schedule is no
 * tab since the bar was revised (2026-10-15): it lives inside Sessions, so its step lights Sessions
 * and says so.
 */
const FULL_TABS: readonly TabName[] = ['dashboard', 'sessions', 'progress', 'more'];
const TAB_OF: Record<string, TabName> = {
  'nav-dashboard': 'dashboard',
  'nav-sessions': 'sessions',
  'nav-progress': 'progress',
};
/** Pages reached from inside a tab rather than from More. */
const INSIDE_TAB: Record<string, { tab: TabName; within: 'Sessions' }> = {
  'nav-schedule': { tab: 'sessions', within: 'Sessions' },
};

/**
 * Where a step points on the phone: a view registered under its id (`useTourTarget`), or a tab.
 * A menu item that is not a tab points at the tab it is found in -- More for most, Sessions for
 * Schedule -- and the card says so: the web's "You will find it in the menu" for a phone-width
 * sidebar.
 */
export type TourPlacement =
  | { kind: 'view'; id: string }
  | { kind: 'tab'; index: number; within: 'More' | 'Sessions' | null };

export function placementOf(target: string, tabs: readonly TabName[] = FULL_TABS): TourPlacement {
  if (target.startsWith('nav-')) {
    const own = TAB_OF[target];
    const index = own ? tabs.indexOf(own) : -1;
    if (index >= 0) return { kind: 'tab', index, within: null };
    const inside = INSIDE_TAB[target];
    const insideIndex = inside ? tabs.indexOf(inside.tab) : -1;
    if (inside && insideIndex >= 0) return { kind: 'tab', index: insideIndex, within: inside.within };
    return { kind: 'tab', index: tabs.indexOf('more'), within: 'More' };
  }
  return { kind: 'view', id: target };
}
