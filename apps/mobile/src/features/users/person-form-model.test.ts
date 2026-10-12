import { createUserRequestSchema, type UserDetail } from '@tmi/shared';

import {
  EMPTY,
  addGuardian,
  fromDetail,
  handlesHint,
  parsePreset,
  parseSections,
  removeGuardian,
  setHandle,
  toRequest,
  todayIso,
  updateGuardian,
  type FormState,
} from './person-form-model';

const TODAY = '2026-10-09';

it('sends a null profile for each role not held, and no availability for a parent', () => {
  const body = toRequest(
    { ...EMPTY, roles: ['parent'], availability: [{ day_of_week: 2, hour: 16 }] },
    TODAY,
  );
  expect(body.tutor_profile).toBeNull();
  expect(body.student_profile).toBeNull();
  expect(body.availability).toEqual([]);
});

it('keeps a recorded SSN date, dates a new tick today, and clears an unticked one', () => {
  const tutor = (patch: Partial<FormState['tutor']>): FormState => ({
    ...EMPTY,
    roles: ['tutor'],
    tutor: { ...EMPTY.tutor, ...patch },
  });
  expect(
    toRequest(tutor({ ssn_received: true, ssn_received_on: '2025-01-05' }), TODAY).tutor_profile
      ?.ssn_received_on,
  ).toBe('2025-01-05');
  expect(toRequest(tutor({ ssn_received: true }), TODAY).tutor_profile?.ssn_received_on).toBe(TODAY);
  expect(
    toRequest(tutor({ ssn_received: false, ssn_received_on: '2025-01-05' }), TODAY).tutor_profile
      ?.ssn_received_on,
  ).toBeNull();
});

it('converts typed dollars to cents and minutes to a number', () => {
  const body = toRequest(
    {
      ...EMPTY,
      roles: ['tutor'],
      tutor: { ...EMPTY.tutor, rate_in_person: '$70', topup: '', max_minutes: '120' },
    },
    TODAY,
  );
  expect(body.tutor_profile?.default_rate_in_person_cents).toBe(7000);
  expect(body.tutor_profile?.topup_amount_cents).toBeNull();
  expect(body.tutor_profile?.max_session_minutes).toBe(120);
});

it('round-trips a record through the form', () => {
  const detail = {
    id: 'u1',
    email: null,
    full_name: 'Ben Whitfield',
    phone: null,
    status: 'active',
    roles: ['student'],
    created_at: '',
    updated_at: '',
    last_login_at: null,
    deleted_at: null,
    shared_fields_locked: false,
    last_entered_at: null,
    tutor_profile: null,
    student_profile: {
      school: 'Ephesus',
      current_math_course: null,
      academic_year_goal: null,
      virtual_available: false,
      charge_rate_in_person_cents: 9500,
      charge_rate_virtual_cents: null,
      max_session_minutes: 60,
    },
    payment_handles: [],
    availability: [{ day_of_week: 6, hour: 10 }],
    guardians: [{ user_id: 'p1', full_name: 'Dana', email: null, relationship: 'mother', is_primary: true }],
    dependents: [],
  } satisfies UserDetail;
  const form = fromDetail(detail);
  expect(form.email).toBe('');
  expect(form.student.charge_in_person).toBe('95.00');
  expect(form.guardians).toEqual([{ guardian_user_id: 'p1', relationship: 'mother', is_primary: true }]);
  const body = toRequest(form, TODAY);
  expect(body.student_profile?.charge_rate_in_person_cents).toBe(9500);
  expect(body.student_profile?.max_session_minutes).toBe(60);
});

it('reads only known sections and roles from the route', () => {
  expect(parseSections(undefined)).toBeUndefined();
  expect(parseSections('identity, bogus,guardians')).toEqual(['identity', 'guardians']);
  expect(parseSections('bogus')).toBeUndefined();
  expect(parsePreset('student,wizard,parent')).toEqual(['student', 'parent']);
});

it('requires an email of anyone who signs in, and refuses an SSN in a note', () => {
  const student = createUserRequestSchema.safeParse(
    toRequest({ ...EMPTY, full_name: 'Mila', roles: ['student'] }, TODAY),
  );
  expect(student.success).toBe(true);
  const tutor = createUserRequestSchema.safeParse(
    toRequest({ ...EMPTY, full_name: 'Ravi', roles: ['tutor'] }, TODAY),
  );
  expect(tutor.success).toBe(false);
  expect(tutor.error?.issues.some((issue) => issue.path.join('.') === 'email')).toBe(true);
  const ssn = createUserRequestSchema.safeParse(
    toRequest(
      {
        ...EMPTY,
        full_name: 'Ravi',
        email: 'ravi@example.com',
        roles: ['tutor'],
        tutor: { ...EMPTY.tutor, availability_notes: 'SSN 123-45-6789' },
      },
      TODAY,
    ),
  );
  expect(ssn.success).toBe(false);
});

it('keeps exactly one primary guardian as links come and go', () => {
  let links = addGuardian([], 'a');
  links = addGuardian(links, 'b');
  expect(links.map((l) => l.is_primary)).toEqual([true, false]);
  links = updateGuardian(links, 'b', { is_primary: true });
  expect(links.map((l) => l.is_primary)).toEqual([false, true]);
  links = removeGuardian(links, 'b');
  expect(links).toEqual([{ guardian_user_id: 'a', relationship: 'guardian', is_primary: true }]);
  expect(addGuardian(links, 'a')).toBe(links);
});

it('holds one payment id per method and drops a cleared one', () => {
  let handles = setHandle([], 'venmo', ' @ravi ');
  handles = setHandle(handles, 'venmo', '@ravi-shah');
  expect(handles).toEqual([{ method: 'venmo', handle: '@ravi-shah' }]);
  expect(setHandle(handles, 'venmo', '  ')).toEqual([]);
  expect(handlesHint(['tutor', 'parent'])).toMatch(/both/);
});

it('dates on the organization clock', () => {
  // 03:00 UTC is still the previous evening in New York.
  expect(todayIso('America/New_York', new Date('2026-10-09T03:00:00Z'))).toBe('2026-10-08');
});
