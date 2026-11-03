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
 * The tour for each role, in the order a newcomer needs it: the home's own
 * blocks first (Phase 66), then the menu. Copy speaks of "the office"
 * and never names the institute -- the same build serves the demo too.
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
      target: 'nav-dashboard',
      title: 'Dashboard',
      body: 'Counts, lessons, progress and recent activity on Tutoring, which shows no money. Charges, pay, balances and year-end are on Finance.',
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
      body: 'Getting started reopens this tour, and the guided setup for a new student or tutor.',
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
      target: 'nav-dashboard',
      title: 'Dashboard',
      body: 'Your lessons, what your students said and their progress. Your pay is on Finance.',
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
      target: 'nav-dashboard',
      title: 'Dashboard',
      body: 'Reflections, progress, recent lessons and what you owe.',
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
      target: 'home-band',
      title: 'Your lessons at a glance',
      body: 'When your next lesson is, and how your week is going.',
    },
    {
      target: 'home-next-up',
      title: 'Next up',
      body: 'The one thing to do now: an assessment to finish, today’s 5, or your next lesson.',
    },
    {
      target: 'nav-dashboard',
      title: 'Dashboard',
      body: 'Your lessons, your reflections and your progress.',
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
