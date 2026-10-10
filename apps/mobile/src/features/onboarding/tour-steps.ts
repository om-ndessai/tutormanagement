// Ported from apps/web/src/features/onboarding/tour-steps.ts @ 1132322. The steps and their copy are
// the web's; only "Getting started" says where the phone keeps it (the account menu), and
// `placementOf` says where each target is on a phone: a registered view, or a tab of the tab bar
// (the menu items the tab bar has no room for live under More).
import type { UserRole } from '@tmi/shared';

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
      target: 'dash-analytics',
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
      target: 'dash-activity',
      title: 'Recent activity',
      body: 'The latest things people did in the portal. The full log is under Activity.',
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
      target: 'dash-analytics',
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

/** The tab bar, in its order (`app/(org)/(tabs)/_layout.tsx`). */
export const TAB_COUNT = 5;
const TAB_INDEX: Record<string, number> = {
  'nav-dashboard': 0,
  'nav-sessions': 1,
  'nav-schedule': 2,
  'nav-progress': 3,
};
const MORE_TAB = 4;

/**
 * Where a step points on the phone: a view registered under its id (`useTourTarget`), or a tab.
 * A menu item that is not a tab points at More, and the card says it is found there -- the web's
 * "You will find it in the menu" for a phone-width sidebar.
 */
export type TourPlacement = { kind: 'view'; id: string } | { kind: 'tab'; index: number; underMore: boolean };

export function placementOf(target: string): TourPlacement {
  if (target.startsWith('nav-')) {
    const index = TAB_INDEX[target];
    return index === undefined
      ? { kind: 'tab', index: MORE_TAB, underMore: true }
      : { kind: 'tab', index, underMore: false };
  }
  return { kind: 'view', id: target };
}
