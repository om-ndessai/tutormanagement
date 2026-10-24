// The create button's actions (UI upgrades U2): the reader's own, each routing to what exists
// today (U3: adding a student or a tutor is a step flow). Who may take each is the gating of the screen it used to live on (Sessions, Schedule,
// Users, Billing), not a new rule: the route checks the role again on arrival, and the server
// after that. A reader with none (a parent, a student) gets no create button at all.
//
// Phase 50: the actions follow the feature sets. Without Tutoring the lesson, tutor and payment
// actions are gone, and an admin is offered Start an assessment instead while Assessment is on.
import { featureOn, type FeatureState, type UserRole as Role } from '@tmi/shared';
import type { Href } from 'expo-router';

export type CreateActionId =
  | 'record-session'
  | 'start-lesson'
  | 'schedule-lesson'
  | 'add-student'
  | 'add-tutor'
  | 'add-person'
  | 'record-payment'
  | 'start-assessment';

export interface CreateAction {
  id: CreateActionId;
  title: string;
  description: string;
  /** A Material Community Icons name, as Paper draws it. */
  icon: string;
  href: Href;
}

/** Everything the sheet can offer, in the order it lists them: the daily ones first. */
const ACTIONS: Record<CreateActionId, CreateAction> = {
  'record-session': {
    id: 'record-session',
    title: 'Record a lesson',
    description: 'Write up a lesson that has happened.',
    icon: 'book-plus-outline',
    // The record step flow (UI upgrades U4): Tutoring, the length and never money, wherever the + was
    // tapped.
    href: '/record-lesson',
  },
  'start-lesson': {
    id: 'start-lesson',
    title: 'Start a lesson',
    description: 'Run the timer while you teach.',
    icon: 'play-circle-outline',
    href: '/start-lesson',
  },
  'schedule-lesson': {
    id: 'schedule-lesson',
    title: 'Schedule a lesson',
    description: 'A standing weekly lesson.',
    icon: 'calendar-plus',
    // The schedule step flow (UI upgrades U5); editing one stays the sheet.
    href: '/schedule-lesson',
  },
  'start-assessment': {
    id: 'start-assessment',
    title: 'Start an assessment',
    description: 'Handwritten, one question a page.',
    icon: 'draw-pen',
    href: '/assessments',
  },
  'add-student': {
    id: 'add-student',
    title: 'Add a student',
    description: 'With their parent or guardian.',
    icon: 'account-school-outline',
    // Family first (UI upgrades U3): the parent is chosen, or added, before the student.
    href: '/add-student',
  },
  'add-tutor': {
    id: 'add-tutor',
    title: 'Add a tutor',
    description: 'Someone who teaches here.',
    icon: 'human-male-board',
    href: '/add-tutor',
  },
  'add-person': {
    id: 'add-person',
    title: 'Add someone else',
    description: 'A parent, an admin, or several roles at once.',
    icon: 'account-plus-outline',
    href: '/person-form',
  },
  'record-payment': {
    id: 'record-payment',
    title: 'Record a payment',
    description: 'Money received from a family or paid to a tutor.',
    icon: 'cash-plus',
    href: '/payment-form',
  },
};

export interface CreateContext {
  /** The reader tutors at least one student here (their own pairings have loaded and are not empty). */
  teaches?: boolean;
  /** The reader has a live lesson running: Start is the banner's business then. */
  lessonRunning?: boolean;
}

/** Phase 50: the feature sets on here that the sheet follows (fixed per session, so no flicker). */
export interface CreateSets {
  tutoring: boolean;
  assessment: boolean;
}

/** Every set on: what a space from before Phase 50 has, and the default. */
export const ALL_CREATE_SETS: CreateSets = { tutoring: true, assessment: true };

/** The sets the sheet follows, from the session's organization. */
export function createSetsOf(organization: Partial<FeatureState> | null | undefined): CreateSets {
  return { tutoring: featureOn(organization, 'tutoring'), assessment: featureOn(organization, 'assessment') };
}

/** The actions this reader may take, in the sheet's order. */
export function createActions(
  roles: readonly Role[] | undefined,
  { teaches = false, lessonRunning = false }: CreateContext = {},
  sets: CreateSets = ALL_CREATE_SETS,
): CreateAction[] {
  const isAdmin = roles?.includes('admin') ?? false;
  const isTutor = roles?.includes('tutor') ?? false;
  const ids: CreateActionId[] = [];
  if (!sets.tutoring) {
    // A space without Tutoring: an admin starts assessments and adds people; nobody else creates.
    if (isAdmin && sets.assessment) ids.push('start-assessment');
    if (isAdmin) ids.push('add-student', 'add-person');
    return ids.map((id) => ACTIONS[id]);
  }
  // Sessions: recording is a tutor's or the office's.
  if (isTutor || isAdmin) ids.push('record-session');
  // Sessions: a live lesson is a tutor's own, with a student of their own, one at a time.
  if (isTutor && teaches && !lessonRunning) ids.push('start-lesson');
  // Schedule: tutors and the office set up standing lessons.
  if (isTutor || isAdmin) ids.push('schedule-lesson');
  // Users and Billing: only the organization's admins add people and record payments.
  if (isAdmin) ids.push('add-student', 'add-tutor', 'add-person', 'record-payment');
  return ids.map((id) => ACTIONS[id]);
}

/** Whether the reader gets a create button at all: from the roles alone, so the bar never flickers. */
export function hasCreateActions(
  roles: readonly Role[] | undefined,
  sets: CreateSets = ALL_CREATE_SETS,
): boolean {
  return createActions(roles, { teaches: true }, sets).length > 0;
}
