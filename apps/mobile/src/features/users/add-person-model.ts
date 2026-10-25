// The pure half of the Add a student and Add a tutor step flows (UI upgrades U3; build log #48).
// The draft is the person form's own `FormState`, and the request is its `toRequest`: the flows ask
// the same things in a different order, so validation is the shared schema's, cut per step.
import { createUserRequestSchema, type Organization, type StudentBalance } from '@tmi/shared';

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
