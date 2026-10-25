// The step flows' validation is the shared schema's, cut per step (UI upgrades U3).
import {
  GUARDIAN_REQUIRED_MESSAGE,
  STUDENT_STEP_FIELDS,
  TUTOR_STEP_FIELDS,
  childrenByParent,
  consentIssue,
  consentNeeded,
  familyIssues,
  parentLine,
  pickErrors,
  reconcileGuardians,
  stepIssues,
} from './add-person-model';
import { EMPTY, type FormState } from './person-form-model';

const TODAY = '2026-10-15';
const ANITA = '00000000-0000-4000-8000-000000000007';
const RAJ = '00000000-0000-4000-8000-000000000008';

const student = (patch: Partial<FormState> = {}): FormState => ({ ...EMPTY, roles: ['student'], ...patch });
const tutor = (patch: Partial<FormState> = {}): FormState => ({ ...EMPTY, roles: ['tutor'], ...patch });

test('a step reports only the shared schema messages for its own fields', () => {
  const draft = student({ email: 'not-an-email' });
  const own = stepIssues(draft, TODAY, STUDENT_STEP_FIELDS.student);
  expect(Object.keys(own).sort()).toEqual(['email', 'full_name']);
  expect(own.full_name).toBe('Name is required.');
  // The same draft is fine as far as School and goal is concerned.
  expect(stepIssues(draft, TODAY, STUDENT_STEP_FIELDS.school)).toEqual({});
});

test('a student needs no email; a tutor does', () => {
  expect(stepIssues(student({ full_name: 'Mila Novak' }), TODAY, STUDENT_STEP_FIELDS.student)).toEqual({});
  const basics = stepIssues(tutor({ full_name: 'Ravi Shah' }), TODAY, TUTOR_STEP_FIELDS.basics);
  expect(Object.keys(basics)).toEqual(['email']);
});

test('an SSN typed into a free-text field is refused on the step that holds it', () => {
  const draft = tutor({
    full_name: 'Ravi Shah',
    email: 'ravi@example.com',
    tutor: { ...EMPTY.tutor, area: '123-45-6789' },
  });
  expect(Object.keys(stepIssues(draft, TODAY, TUTOR_STEP_FIELDS.background))).toEqual(['tutor_profile.area']);
  expect(stepIssues(draft, TODAY, TUTOR_STEP_FIELDS.basics)).toEqual({});
});

test('the family step asks for a guardian before the schema has anything to say', () => {
  expect(familyIssues(student(), TODAY)).toEqual({ guardians: GUARDIAN_REQUIRED_MESSAGE });
  const linked = student({ guardians: [{ guardian_user_id: ANITA, relationship: 'mother', is_primary: true }] });
  expect(familyIssues(linked, TODAY)).toEqual({});
});

test('nested keys fold onto the field that owns them', () => {
  expect(
    pickErrors(
      { 'guardians.0.guardian_user_id': 'Invalid UUID', 'guardians.1.relationship': 'Bad', full_name: 'x' },
      ['guardians'],
    ),
  ).toEqual({ guardians: 'Invalid UUID' });
});

test('the picker ticks become guardian links, keeping relationships and one primary', () => {
  let links = reconcileGuardians([], [ANITA]);
  expect(links).toEqual([{ guardian_user_id: ANITA, relationship: 'guardian', is_primary: true }]);
  links = [{ ...links[0]!, relationship: 'mother' }];
  links = reconcileGuardians(links, [ANITA, RAJ]);
  expect(links).toEqual([
    { guardian_user_id: ANITA, relationship: 'mother', is_primary: true },
    { guardian_user_id: RAJ, relationship: 'guardian', is_primary: false },
  ]);
  // Unticking the primary hands it to the one left.
  expect(reconcileGuardians(links, [RAJ])).toEqual([
    { guardian_user_id: RAJ, relationship: 'guardian', is_primary: true },
  ]);
});

test("a parent's row names their children, else shows their email", () => {
  const children = childrenByParent([
    { student_name: 'Sofia Patel', guardians: [{ user_id: ANITA, full_name: 'Anita Patel', is_primary: true }] },
    { student_name: 'Leo Patel', guardians: [{ user_id: ANITA, full_name: 'Anita Patel', is_primary: true }] },
    { student_name: 'Mia Patel', guardians: [{ user_id: ANITA, full_name: 'Anita Patel', is_primary: false }] },
  ]);
  expect(parentLine(children[ANITA], 'anita@example.com')).toBe('Parent of Sofia, Leo and Mia');
  expect(parentLine(children[RAJ], 'raj@example.com')).toBe('raj@example.com');
  expect(parentLine(['Sofia Patel'], null)).toBe('Parent of Sofia');
  expect(parentLine(undefined, null)).toBeUndefined();
});

describe('consent in a self-serve space (Phase 52)', () => {
  const selfServe = { created_via: 'self_serve' as const };
  const console_ = { created_via: 'console' as const };
  it('is needed for a student added to a self-serve space only', () => {
    expect(consentNeeded({ roles: ['student'] }, selfServe)).toBe(true);
    expect(consentNeeded({ roles: ['parent'] }, selfServe)).toBe(false);
    expect(consentNeeded({ roles: ['student'] }, console_)).toBe(false);
    expect(consentNeeded({ roles: ['student'] }, null)).toBe(false);
  });
  it('is the server’s sentence until ticked', () => {
    expect(consentIssue({ roles: ['student'] }, selfServe, false)).toBe(
      'Confirm you are their parent or guardian, or have their permission.',
    );
    expect(consentIssue({ roles: ['student'] }, selfServe, true)).toBeNull();
    expect(consentIssue({ roles: ['student'] }, console_, false)).toBeNull();
  });
});
