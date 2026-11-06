// The pure half of the Add a student and Add a tutor step flows (UI upgrades U3; build log #48).
// The draft is the person form's own `FormState`, and the request is its `toRequest`: the flows ask
// the same things in a different order, so validation is the shared schema's, cut per step.
import {
  addChoices,
  createUserRequestSchema,
  featureAllowed,
  featureOn,
  mayAddPeople,
  nextStepsAfterAdd,
  paidDirectly,
  type AddChoice,
  type AddChoiceOption,
  type NextStepAfterAddId,
  type Organization,
  type PlatformAccount,
  type StudentBalance,
  type UserRole,
} from '@tmi/shared';
import type { Href } from 'expo-router';

import type { SavedForm } from '@/lib/form-bridge';

import { issuesToErrors } from '@/features/teaching/session-form/use-session-form';
import { addGuardian, removeGuardian, toRequest, type FormState, type GuardianValue } from './person-form-model';

/** The server's field names each step owns: its validation, and where a refusal sends the flow. */
export const STUDENT_STEP_FIELDS = {
  family: ['guardians'],
  student: ['full_name', 'email', 'phone', 'roles', 'status'],
  school: [
    'student_profile.school',
    'student_profile.current_math_course',
    'student_profile.academic_year_goal',
  ],
  availability: ['availability'],
  lessons: ['student_profile.virtual_available', 'student_profile.max_session_minutes', 'student_profile'],
  price: ['student_profile.charge_rate_in_person_cents', 'student_profile.charge_rate_virtual_cents'],
} as const;

export const TUTOR_STEP_FIELDS = {
  basics: ['full_name', 'email', 'phone', 'roles', 'status'],
  background: ['tutor_profile.highest_education', 'tutor_profile.school', 'tutor_profile.area'],
  teaching: ['tutor_profile.virtual_available', 'tutor_profile.max_session_minutes'],
  availability: ['availability'],
  pay: [
    'tutor_profile.default_rate_in_person_cents',
    'tutor_profile.default_rate_virtual_cents',
    'tutor_profile.topup_amount_cents',
    'tutor_profile',
  ],
} as const;

/**
 * The API's guardian rule, which no schema can hold (a student must have a guardian who is a
 * member here): the same sentence the API answers with, so the step says it before the server does.
 */
export const GUARDIAN_REQUIRED_MESSAGE = 'A student must have at least one parent or guardian.';

/** Every message the shared schema has for the request this draft would send, by dotted field. */
export function requestErrors(form: FormState, today: string): Record<string, string> {
  const parsed = createUserRequestSchema.safeParse(toRequest(form, today));
  return parsed.success ? {} : issuesToErrors(parsed.error.issues);
}

/**
 * The messages for one step's fields. A nested key folds onto the field that owns it
 * (`guardians.0.guardian_user_id` is the Family step's `guardians`); the first message wins.
 */
export function pickErrors(all: Record<string, string>, fields: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(all)) {
    const owner = fields.find((field) => key === field || key.startsWith(`${field}.`));
    if (owner && !out[owner]) out[owner] = message;
  }
  return out;
}

/** One step's validation: the shared schema's issues for its fields. */
export function stepIssues(form: FormState, today: string, fields: readonly string[]): Record<string, string> {
  return pickErrors(requestErrors(form, today), fields);
}

/** The Family step: at least one guardian, then whatever the schema says about the links. */
export function familyIssues(form: FormState, today: string): Record<string, string> {
  if (form.guardians.length === 0) return { guardians: GUARDIAN_REQUIRED_MESSAGE };
  return stepIssues(form, today, STUDENT_STEP_FIELDS.family);
}

/**
 * Brings the guardian links in line with the ids ticked in the picker: a new id is added (the first
 * becomes the primary contact), an unticked one removed, and the rest keep their relationship.
 */
export function reconcileGuardians(links: GuardianValue[], ids: readonly string[]): GuardianValue[] {
  let next = links;
  // removeGuardian never leaves the rest without a primary contact; addGuardian makes the first one it.
  for (const link of links) {
    if (!ids.includes(link.guardian_user_id)) next = removeGuardian(next, link.guardian_user_id);
  }
  for (const id of ids) next = addGuardian(next, id);
  return next;
}

/**
 * The children each parent is responsible for, by parent id, from the balances read (the parent
 * rows carry none). Names only: nothing of the balance is kept.
 */
export function childrenByParent(students: readonly Pick<StudentBalance, 'student_name' | 'guardians'>[]) {
  const out: Record<string, string[]> = {};
  for (const student of students) {
    for (const guardian of student.guardians) (out[guardian.user_id] ??= []).push(student.student_name);
  }
  return out;
}

/** A parent row's second line: their children's first names, else their email. */
export function parentLine(children: readonly string[] | undefined, email: string | null): string | undefined {
  if (children && children.length > 0) {
    const first = children.map((name) => name.split(/\s+/)[0] ?? name);
    return `Parent of ${listNames(first)}`;
  }
  return email ?? undefined;
}

/** "Sofia", "Sofia and Leo", "Sofia, Leo and Mia". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Phase 52: the server's sentence when a student is added to a self-serve space without consent. */
export const CONSENT_MESSAGE = 'Confirm you are their parent or guardian, or have their permission.';

/** Phase 52: the consent's words, as the web's person form has them. */
export const CONSENT_LABEL =
  'I am this student’s parent or guardian, or have their permission, for them to take part here — including answers they write on the canvas.';

/**
 * Phase 52: whether adding this person needs a parent's consent -- a student, in a space a newcomer
 * made (`self_serve`). The server decides; this asks before it does.
 */
export function consentNeeded(
  form: Pick<FormState, 'roles'>,
  org: Pick<Organization, 'created_via'> | null | undefined,
): boolean {
  return org?.created_via === 'self_serve' && form.roles.includes('student');
}

/** The consent's problem, in the server's words, or null when there is none. */
export function consentIssue(
  form: Pick<FormState, 'roles'>,
  org: Pick<Organization, 'created_via'> | null | undefined,
  consent: boolean,
): string | null {
  return consentNeeded(form, org) && !consent ? CONSENT_MESSAGE : null;
}

// --- Phase 76 (JF21): one Add chooser, and the next step after each save ------------------------------------

/** The space as the chooser and the next steps read it (the session's organization). */
type SpaceSets = Partial<Organization> | null | undefined;

/**
 * The chooser's rows for this reader here: shared `addChoices` -- "A family (parent and child)" (in a personal space
 * "My child"), "A tutor" where Tutoring is on, "Someone else", "Invite by email" -- or none for a reader who may not add
 * people (not an admin, or a 13-17).
 */
export function chooserChoices(
  org: SpaceSets,
  reader: { roles: readonly UserRole[]; account: PlatformAccount | null } | null,
): AddChoiceOption[] {
  return addChoices({
    tutoring: featureAllowed(org, 'tutoring'),
    personal: org?.personal ?? false,
    mayAdd: reader ? mayAddPeople(reader) : false,
  });
}

/** Each choice's icon, as the (+) sheet draws its rows. */
export const ADD_CHOICE_ICONS: Record<AddChoice, string> = {
  family: 'account-child-outline',
  tutor: 'human-male-board',
  someone: 'account-plus-outline',
  invite: 'email-fast-outline',
};

/**
 * Where a choice leads: the family flow (in a personal space with the reader as the parent, `guardian=me`), the
 * tutor flow, the person form (`from=add`, so it ends on the next steps), or the invitation sheet.
 */
export function addChoiceHref(choice: AddChoice, { personal }: { personal: boolean }): Href {
  switch (choice) {
    case 'family':
      return personal ? { pathname: '/add-student', params: { guardian: 'me' } } : '/add-student';
    case 'tutor':
      return '/add-tutor';
    case 'someone':
      return { pathname: '/person-form', params: { from: 'add' } };
    case 'invite':
      return '/invite-people';
  }
}

/** Shown when the chooser has nothing to offer this reader. */
export const ADD_CHOOSER_LOCKED = "Only the space's admins add people.";

/** Someone just added, as the next steps need them. */
export interface AddedPersonRef {
  id: string;
  name: string;
  roles: readonly UserRole[];
}

/** One next step on the "<name> is added" screen: shared `nextStepsAfterAdd`'s words, and where each goes here. */
export interface NextStepView {
  id: NextStepAfterAddId;
  label: string;
  description: string;
  icon: string;
  /** Null while it cannot be taken yet (a weekly lesson before the pairing). */
  href: Href | null;
  /** A sheet or flow that announces its save, ticked here (`form-bridge`); absent for a step that leaves. */
  form?: SavedForm;
  /** Close the screen, then go (Start an assessment, where there is no Tutoring). */
  leave?: boolean;
}

/** The space's sets for the next steps. */
export function nextStepSets(org: SpaceSets): { tutoring: boolean; assessment: boolean; paysTutors: boolean } {
  return {
    tutoring: featureAllowed(org, 'tutoring'),
    assessment: featureOn(org, 'assessment'),
    // A space whose families pay each tutor directly files no 1099s: no tax setup to finish.
    // (A session from an older Worker carries no `business`: counted as paying its tutors.)
    paysTutors: org?.business === undefined ? true : !paidDirectly({ business: org.business }),
  };
}

/**
 * What to do next with someone just added (shared `nextStepsAfterAdd`): "Pair Yusuf with a tutor", then "Set a
 * weekly lesson" -- which needs the pairing first (`pairingId`, from the pairing form's save) -- and "Record an
 * assessment"; for a tutor "Pair Alex with a student" and "Finish tax setup".
 */
export function addPersonNextSteps(
  person: AddedPersonRef,
  sets: { tutoring: boolean; assessment: boolean; paysTutors: boolean },
  pairingId: string | null = null,
): NextStepView[] {
  return nextStepsAfterAdd({ full_name: person.name, roles: person.roles }, sets).map((step): NextStepView => {
    switch (step.id) {
      case 'pair_tutor':
        return {
          ...step,
          description: 'Lessons can be recorded once they are paired.',
          icon: 'account-switch-outline',
          href: { pathname: '/assignment-form', params: { student: person.id } },
          form: 'assignment',
        };
      case 'weekly_lesson':
        return {
          ...step,
          description: pairingId ? 'The same day and time each week.' : 'Pair them with a tutor first.',
          icon: 'calendar-sync-outline',
          href: pairingId ? { pathname: '/schedule-lesson', params: { assignment: pairingId } } : null,
          form: 'schedule',
        };
      case 'assessment':
        // With Tutoring, the progress assessment (the level and a score per topic); without, the handwritten one.
        return sets.tutoring
          ? {
              ...step,
              description: 'Where they stand: the level you recommend and a score per topic.',
              icon: 'clipboard-text-outline',
              href: { pathname: '/assessment-form', params: { student: person.id } },
              form: 'assessment',
            }
          : {
              ...step,
              description: 'Handwritten, one question a page.',
              icon: 'draw-pen',
              href: { pathname: '/assessments', params: { student: person.id } },
              leave: true,
            };
      case 'pair_student':
        return {
          ...step,
          description: 'Which student they teach, and at what rate.',
          icon: 'account-switch-outline',
          href: { pathname: '/assignment-form', params: { tutor: person.id } },
          form: 'assignment',
        };
      case 'tax_setup':
        return {
          ...step,
          description: 'Their mailing address for the 1099, and whether the office holds their SSN.',
          icon: 'file-document-outline',
          href: { pathname: '/person-form', params: { id: person.id, sections: 'tutor-tax' } },
          form: 'person',
        };
    }
  });
}
