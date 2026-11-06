// Ported from apps/web/src/features/onboarding/tour-steps.ts @ 1132322. The steps and their copy are
// the web's; only "Getting started" says where the phone keeps it (the account menu), and
// `placementOf` says where each target is on a phone: a registered view, or a tab of the tab bar
// (the menu items the tab bar has no room for live under More).
// Phase 66 (re-ported 2026-11-04 from the web's tour-steps.ts): the tour starts on the member home's
// blocks (the band, Next up, To record, the children), then the menu; the dashboard's own sections
// moved to More → Dashboard with the dashboard, so the tour no longer lights them.
// Phase 50: the tour follows the feature sets (`tourStepsFor`): a menu step whose page is not on
// here is dropped, a space without Tutoring gets the space home's own steps, and the tab a step
// points at is found among the tabs the bar shows here.
// Phase 73 (JF23): the members' Daily by its one name ("today’s Daily", the web's words).
// Phase 74 (JF25, JF31): the parent's tour has no Billing step -- Billing is not in a parent's menu (admins and tutors
// only, `seesPeoplePages`); what a parent owes is on the Dashboard, which the tour already shows.
import { COMMON_COPY, featureOn, type FeatureState, type UserRole } from '@tmi/shared';

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

// The web's "Dashboard" page (its `nav-dashboard`) is the app's More → Dashboard (`nav-analytics`): the
// app's `nav-dashboard` is the Home tab itself. So the Dashboard steps point at `nav-analytics`, which
// lights More and says "You will find it under More".
const DASHBOARD = 'nav-analytics';

/**
 * The tour for each role, in the order a newcomer needs it: the home's own blocks first (Phase 66),
 * then the menu. Copy speaks of "the office" and never names the institute -- the same build serves
 * the demo too.
 */
export const TOUR_STEPS: Record<UserRole, TourStep[]> = {
  admin: [
    {
      target: 'home-band',
      title: 'Your space at a glance',
      body: 'Your day here: lessons not yet recorded, invitations waiting and today’s lessons.',
    },
    {
      target: 'home-next-up',
      title: 'Next up',
      body: 'The one thing to do now. Later puts it off for the day.',
    },
    {
      target: DASHBOARD,
      title: 'Dashboard',
      body: 'Counts, lessons, progress and recent activity on Tutoring, which shows no money. Charges, pay, balances and year-end are on Finance.',
    },
    {
      target: 'nav-users',
      title: COMMON_COPY.people_page,
      body: 'Everyone, once: one person can be a parent, a tutor and an admin. Add families and tutors here.',
    },
    {
      target: 'nav-assignments',
      title: 'Pairings',
      body: 'Which tutor teaches which student, and at what rate. A lesson needs a pairing.',
    },
    {
      target: 'nav-sessions',
      title: COMMON_COPY.lessons_page,
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
      target: 'home-band',
      title: 'Your teaching at a glance',
      body: 'Today’s lessons and what is still to record.',
    },
    {
      target: 'home-next-up',
      title: 'Next up',
      body: 'A lesson just finished: record it in one tap, already filled in from the schedule. One about to start: start it from here.',
    },
    {
      target: 'home-to-record',
      title: 'To record',
      body: 'Lessons of the last week that were never written up. Record each one from here.',
    },
    {
      target: DASHBOARD,
      title: 'Dashboard',
      body: 'Your lessons, what your students said and their progress. Your pay is on Finance.',
    },
    {
      target: 'nav-sessions',
      title: COMMON_COPY.lessons_page,
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
      target: 'home-section-parent',
      title: 'Your children',
      body: 'Each child’s next lesson, any change to it, and the homework from last time.',
    },
    {
      target: 'home-next-up',
      title: 'Next up',
      body: 'What matters now, such as a cancelled lesson or the next one coming.',
    },
    {
      target: DASHBOARD,
      title: 'Dashboard',
      body: 'Reflections, progress, recent lessons and what you owe.',
    },
    {
      target: 'nav-sessions',
      title: COMMON_COPY.lessons_page,
      body: 'Every lesson with its notes, homework, reflections and assessments.',
    },
    {
      target: 'nav-schedule',
      title: 'Schedule',
      body: 'Weekly lessons and calendar files. Away one week? Cancel just that date.',
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
      target: 'home-band',
      title: 'Your lessons at a glance',
      body: 'When your next lesson is, and how your week is going.',
    },
    {
      target: 'home-next-up',
      title: 'Next up',
      body: 'The one thing to do now: an assessment to finish, today’s Daily, or your next lesson.',
    },
    {
      target: DASHBOARD,
      title: 'Dashboard',
      body: 'Your lessons, your reflections and your progress.',
    },
    {
      target: 'nav-sessions',
      title: COMMON_COPY.lessons_page,
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
  body: 'Question Quest, and quests to play alone or together: questions one at a time.',
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
      title: COMMON_COPY.people_page,
      body: 'Everyone, once: one person can be a parent and an admin. Add families here.',
    },
    { target: 'nav-activity', title: 'Activity', body: 'The audit log: who did what, and when.' },
    {
      target: 'nav-organization',
      title: 'Space settings',
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
 * The tab bar, in its order (`features/shell/app-tab-bar.tsx`): Home, Lessons, Progress, More,
 * the "+" not counted -- or Home and More where Tutoring is off (`visibleTabs`). Schedule is no
 * tab since the bar was revised (2026-10-15): it lives inside Lessons (the `sessions` tab), so its
 * step lights Lessons and says so.
 */
const FULL_TABS: readonly TabName[] = ['dashboard', 'sessions', 'progress', 'more'];
const TAB_OF: Record<string, TabName> = {
  'nav-dashboard': 'dashboard',
  'nav-sessions': 'sessions',
  'nav-progress': 'progress',
};
/** Pages reached from inside a tab rather than from More. */
const INSIDE_TAB: Record<string, { tab: TabName; within: 'Lessons' }> = {
  'nav-schedule': { tab: 'sessions', within: 'Lessons' },
};

/**
 * Where a step points on the phone: a view registered under its id (`useTourTarget`), or a tab.
 * A menu item that is not a tab points at the tab it is found in -- More for most, Lessons for
 * Schedule -- and the card says so: the web's "You will find it in the menu" for a phone-width
 * sidebar.
 */
export type TourPlacement =
  { kind: 'view'; id: string } | { kind: 'tab'; index: number; within: 'More' | 'Lessons' | null };

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
