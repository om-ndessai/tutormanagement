// The create button's actions (UI upgrades U2): the reader's own, each routing to what exists
// today (U3: adding a student or a tutor is a step flow). Who may take each is the gating of the screen it used to live on (Sessions, Schedule,
// Users, Billing), not a new rule: the route checks the role again on arrival, and the server
// after that. A reader with none (a parent, a student) gets no create button at all.
//
// Phase 50: the actions follow the feature sets. Without Tutoring the lesson, tutor and payment
// actions are gone, and an admin is offered Start an assessment instead while Assessment is on.
//
// UI audit (JF22): adding people follows ONE rule, shared `mayAddPeople` -- the space's admins, and not a
// 13-17 (Phase 63: a teen adds nobody) -- the same rule as People, the home and the add flows, so nobody is
// offered a form the API would refuse at its end.
//
// UI audit (JF7): "Start a space" closes the list for an adult (shared `mayMakeSpace`), where the (+) already offers
// something -- it opens Spaces on the new space's name. It never gives a (+) of its own to a reader who creates
// nothing here (a parent, a student): they find it in the account sheet, under their spaces.
//
// Phase 75 (JF30): "Record a lesson" opens the lessons still owed (each recorded as planned, "Another lesson" for the
// rest), as the home's quick action and the Sessions page's button do.
//
// Phase 76 (JF21): adding people is ONE row, "Add people", opening the one Add chooser (a family, a tutor, someone else,
// an invitation) -- the same chooser as the home's quick action, People's header and its empty state. In a personal
// space it reads "Add my child".
import {
  featureOn,
  mayAddPeople,
  type FeatureState,
  type PlatformAccount,
  type UserRole as Role,
} from '@tmi/shared';
import type { Href } from 'expo-router';

export type CreateActionId =
  | 'record-session'
  | 'start-lesson'
  | 'schedule-lesson'
  | 'add-people'
  | 'record-payment'
  | 'start-assessment'
  | 'start-space';

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
    // Phase 75 (JF30): the lessons still owed first; "Another lesson" there opens the record step flow (U4):
    // Tutoring, the length and never money, wherever the + was tapped.
    href: '/lessons-owed',
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
  'add-people': {
    id: 'add-people',
    title: 'Add people',
    description: 'A family, a tutor, someone else, or an invitation by email.',
    icon: 'account-plus-outline',
    // Phase 76 (JF21): the one Add chooser; each of its choices opens the flow that does the work (family first, U3).
    href: '/add',
  },
  'record-payment': {
    id: 'record-payment',
    title: 'Record a payment',
    description: 'Money received from a family or paid to a tutor.',
    icon: 'cash-plus',
    href: '/payment-form',
  },
  'start-space': {
    id: 'start-space',
    title: 'Start a space',
    description: 'A new space of your own, for a class, a club or a family.',
    icon: 'plus-box-multiple-outline',
    href: { pathname: '/spaces', params: { start: '1' } },
  },
};

export interface CreateContext {
  /** The reader tutors at least one student here (their own pairings have loaded and are not empty). */
  teaches?: boolean;
  /** The reader has a live lesson running: Start is the banner's business then. */
  lessonRunning?: boolean;
  /** The reader's platform account (their age band, when they signed up themselves): a 13-17 adds nobody. */
  account?: PlatformAccount | null;
  /** The reader may start a space (shared `mayMakeSpace`: an adult): "Start a space" closes the list. */
  mayMakeSpace?: boolean;
  /** Phase 76 (JF21): a personal space, where adding people is adding one's child ("Add my child"). */
  personal?: boolean;
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
  { teaches = false, lessonRunning = false, account = null, mayMakeSpace = false, personal = false }: CreateContext = {},
  sets: CreateSets = ALL_CREATE_SETS,
): CreateAction[] {
  const ids = spaceActions(roles, { teaches, lessonRunning, account }, sets);
  // JF7: last, for an adult, in a list that offers something already.
  if (mayMakeSpace && ids.length > 0) ids.push('start-space');
  return ids.map((id) =>
    personal && id === 'add-people'
      ? { ...ACTIONS[id], title: 'Add my child', description: 'Your child, with you as their parent.' }
      : ACTIONS[id],
  );
}

/** What the reader may create inside this space, in the sheet's order. */
function spaceActions(
  roles: readonly Role[] | undefined,
  { teaches, lessonRunning, account }: { teaches: boolean; lessonRunning: boolean; account: PlatformAccount | null },
  sets: CreateSets,
): CreateActionId[] {
  const isAdmin = roles?.includes('admin') ?? false;
  const isTutor = roles?.includes('tutor') ?? false;
  const addsPeople = mayAddPeople({ roles: roles ?? [], account });
  const ids: CreateActionId[] = [];
  if (!sets.tutoring) {
    // A space without Tutoring: an admin starts assessments and (an adult) adds people; nobody else creates.
    if (isAdmin && sets.assessment) ids.push('start-assessment');
    if (addsPeople) ids.push('add-people');
    return ids;
  }
  // Sessions: recording is a tutor's or the office's.
  if (isTutor || isAdmin) ids.push('record-session');
  // Sessions: a live lesson is a tutor's own, with a student of their own, one at a time.
  if (isTutor && teaches && !lessonRunning) ids.push('start-lesson');
  // Schedule: tutors and the office set up standing lessons.
  if (isTutor || isAdmin) ids.push('schedule-lesson');
  // Users: the space's adult admins add people (JF22). Billing: its admins record payments.
  if (addsPeople) ids.push('add-people');
  if (isAdmin) ids.push('record-payment');
  return ids;
}

/**
 * Whether the reader gets a create button at all: from the roles (and the account, known with the session)
 * alone, so the bar never flickers.
 */
export function hasCreateActions(
  roles: readonly Role[] | undefined,
  sets: CreateSets = ALL_CREATE_SETS,
  account: PlatformAccount | null = null,
): boolean {
  return createActions(roles, { teaches: true, account }, sets).length > 0;
}
