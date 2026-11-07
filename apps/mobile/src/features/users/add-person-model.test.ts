// The step flows' validation is the shared schema's, cut per step (UI upgrades U3).
import {
  ADD_CHOICE_ICONS,
  GUARDIAN_REQUIRED_MESSAGE,
  addChoiceHref,
  addPersonNextSteps,
  chooserChoices,
  nextStepSets,
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

// --- Phase 76 (JF21): one Add chooser, and the next steps ----------------------------------------------------

describe('the Add chooser (Phase 76)', () => {
  const admin = { roles: ['admin'] as const, account: null };

  test('four choices for an adult admin where Tutoring is on, in order (Phase 79: anyone, by email, second)', () => {
    const choices = chooserChoices({}, { roles: [...admin.roles], account: null });
    expect(choices.map((c) => c.id)).toEqual(['family', 'invite', 'tutor', 'someone']);
    expect(choices.map((c) => c.label)).toEqual([
      'A family (parent and child)',
      'Anyone, by email',
      'A tutor',
      'Someone, with details',
    ]);
    expect(choices[1]?.description).toBe('Just their email. They join as a member; give them a role whenever you like.');
    for (const choice of choices) expect(ADD_CHOICE_ICONS[choice.id]).toBeTruthy();
  });

  test('no tutor where Tutoring is off; "My child" in a personal space', () => {
    expect(chooserChoices({ feature_tutoring: false }, { roles: ['admin'], account: null }).map((c) => c.id)).toEqual([
      'family',
      'invite',
      'someone',
    ]);
    const personal = chooserChoices({ feature_tutoring: false, personal: true }, { roles: ['admin'], account: null });
    expect(personal[0]).toMatchObject({ id: 'family', label: 'My child' });
  });

  test('nothing for a reader who may not add people: not an admin, or a 13-17', () => {
    expect(chooserChoices({}, { roles: ['tutor', 'parent'], account: null })).toEqual([]);
    expect(chooserChoices({}, { roles: ['admin'], account: { age_band: '13-17' } as never })).toEqual([]);
    expect(chooserChoices({}, null)).toEqual([]);
  });

  test('each choice opens its flow; "My child" names the reader as the parent', () => {
    expect(addChoiceHref('family', { personal: false })).toBe('/add-student');
    expect(addChoiceHref('family', { personal: true })).toEqual({ pathname: '/add-student', params: { guardian: 'me' } });
    expect(addChoiceHref('tutor', { personal: false })).toBe('/add-tutor');
    expect(addChoiceHref('someone', { personal: false })).toEqual({ pathname: '/person-form', params: { from: 'add' } });
    expect(addChoiceHref('invite', { personal: true })).toBe('/invite-people');
  });
});

describe('the next steps after adding someone (Phase 76)', () => {
  const yusuf = { id: 'yusuf', name: 'Yusuf Haddad', roles: ['student'] as const };
  const alex = { id: 'alex', name: 'Alex Chen', roles: ['tutor'] as const };
  const ALL = { tutoring: true, assessment: true, paysTutors: true };

  test('a student: pair with a tutor, a weekly lesson once paired, an assessment', () => {
    const before = addPersonNextSteps({ ...yusuf, roles: [...yusuf.roles] }, ALL);
    expect(before.map((step) => step.label)).toEqual([
      'Pair Yusuf with a tutor',
      'Set a weekly lesson',
      'Record an assessment',
    ]);
    expect(before[0]).toMatchObject({ href: { pathname: '/assignment-form', params: { student: 'yusuf' } }, form: 'assignment' });
    // Before the pairing there is nothing to schedule.
    expect(before[1]).toMatchObject({ href: null, description: 'Pair them with a tutor first.' });
    expect(before[2]).toMatchObject({ href: { pathname: '/assessment-form', params: { student: 'yusuf' } }, form: 'assessment' });

    const after = addPersonNextSteps({ ...yusuf, roles: [...yusuf.roles] }, ALL, 'pairing-1');
    expect(after[1]).toMatchObject({
      href: { pathname: '/schedule-lesson', params: { assignment: 'pairing-1' } },
      form: 'schedule',
    });
  });

  test('without Tutoring, only the handwritten assessment (where it is on), and it leaves the screen', () => {
    const steps = addPersonNextSteps({ ...yusuf, roles: [...yusuf.roles] }, { ...ALL, tutoring: false });
    expect(steps.map((step) => step.id)).toEqual(['assessment']);
    expect(steps[0]).toMatchObject({ href: { pathname: '/assessments', params: { student: 'yusuf' } }, leave: true });
    expect(addPersonNextSteps({ ...yusuf, roles: [...yusuf.roles] }, { tutoring: false, assessment: false, paysTutors: true })).toEqual([]);
  });

  test('a tutor: pair with a student, and tax setup only where the space pays its tutors', () => {
    const steps = addPersonNextSteps({ ...alex, roles: [...alex.roles] }, ALL);
    expect(steps.map((step) => step.label)).toEqual(['Pair Alex with a student', 'Finish tax setup']);
    expect(steps[1]).toMatchObject({ href: { pathname: '/person-form', params: { id: 'alex', sections: 'tutor-tax' } }, form: 'person' });
    expect(addPersonNextSteps({ ...alex, roles: [...alex.roles] }, { ...ALL, paysTutors: false }).map((s) => s.id)).toEqual([
      'pair_student',
    ]);
  });

  test('a parent or an admin: none', () => {
    expect(addPersonNextSteps({ id: 'p', name: 'Pat', roles: ['parent', 'admin'] }, ALL)).toEqual([]);
  });

  test("the space's sets: paid directly means no tax setup; an older session pays its tutors", () => {
    expect(nextStepSets({ business: null })).toMatchObject({ tutoring: true, paysTutors: false });
    expect(nextStepSets({ business: { id: 'b' } as never })).toMatchObject({ paysTutors: true });
    expect(nextStepSets({})).toMatchObject({ paysTutors: true });
    expect(nextStepSets({ canvas_assessments: true })).toMatchObject({ assessment: true });
  });
});
