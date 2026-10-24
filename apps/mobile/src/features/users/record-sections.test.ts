import type { UserDetail } from '@tmi/shared';

import { personPaymentPrefills } from './people-model';
import { RECORD_SECTIONS, recordSection, recordSections } from './record-sections';

const base: Pick<
  UserDetail,
  | 'id'
  | 'roles'
  | 'deleted_at'
  | 'tutor_profile'
  | 'student_profile'
  | 'availability'
  | 'payment_handles'
  | 'guardians'
  | 'dependents'
> = {
  id: 'p',
  roles: [],
  deleted_at: null,
  tutor_profile: null,
  student_profile: null,
  availability: [],
  payment_handles: [],
  guardians: [],
  dependents: [],
};

const tutorProfile = { availability_notes: null } as UserDetail['tutor_profile'];
const studentProfile = {} as UserDetail['student_profile'];
const ADMIN = { id: 'admin', roles: ['admin'] as const };
const keys = (shown: { key: string }[]) => shown.map((section) => section.key);

describe('recordSections', () => {
  it('gives a student Contact, School and goal, Availability, Lessons and price, and Family', () => {
    const student = {
      ...base,
      roles: ['student' as const],
      student_profile: studentProfile,
      guardians: [{ user_id: 'g', full_name: 'G', email: null, relationship: 'mother' as const, is_primary: true }],
    };
    expect(keys(recordSections(student, ADMIN))).toEqual(['contact', 'school', 'availability', 'lessons', 'family']);
    expect(recordSections(student, ADMIN).every((section) => section.editable)).toBe(true);
  });

  it('gives a tutor Background, Teaching and Pay and tax -- pay only to them and the office', () => {
    const tutor = { ...base, roles: ['tutor' as const], tutor_profile: tutorProfile };
    expect(keys(recordSections(tutor, ADMIN))).toEqual(['contact', 'background', 'availability', 'teaching', 'pay']);
    expect(keys(recordSections(tutor, { id: 'p', roles: ['tutor'] }))).toContain('pay');
    expect(keys(recordSections(tutor, { id: 'other', roles: ['tutor'] }))).not.toContain('pay');
  });

  it('hides empty hours and payment from a reader who cannot fill them in', () => {
    const tutor = { ...base, roles: ['tutor' as const, 'parent' as const], tutor_profile: tutorProfile };
    expect(keys(recordSections(tutor, { id: 'x', roles: ['parent'] }))).toEqual(['contact', 'background', 'teaching']);
    const parent = { ...base, roles: ['parent' as const] };
    expect(keys(recordSections(parent, ADMIN))).toEqual(['contact', 'payment']);
    expect(keys(recordSections(parent, { id: 'p', roles: ['parent'] }))).toEqual(['contact']);
  });

  it('lets only the office edit, on a live record, outside the wizard', () => {
    const tutor = { ...base, roles: ['tutor' as const], tutor_profile: tutorProfile };
    expect(recordSections(tutor, { id: 'p', roles: ['tutor'] }).some((s) => s.editable)).toBe(false);
    expect(recordSections({ ...tutor, deleted_at: '2026-10-01' }, ADMIN).some((s) => s.editable)).toBe(false);
    expect(recordSections(tutor, ADMIN, { compact: true }).some((s) => s.editable)).toBe(false);
  });

  it('reads a parent’s children but edits a family from the child’s record', () => {
    const parent = {
      ...base,
      roles: ['parent' as const],
      dependents: [{ user_id: 'k', full_name: 'K', email: null, relationship: 'father' as const, is_primary: true }],
    };
    expect(recordSections(parent, ADMIN).find((s) => s.key === 'family')?.editable).toBe(false);
  });

  it('maps a section to the person form’s blocks', () => {
    expect(recordSection('pay')?.form).toEqual(['tutor-financials', 'payment-handles']);
    expect(recordSection('contact')?.form).toEqual(['contact']);
    expect(recordSection('nonsense')).toBeUndefined();
    expect(Object.keys(RECORD_SECTIONS)).toHaveLength(9);
  });
});

describe('personPaymentPrefills', () => {
  it('fills who from the record: to a tutor, from a parent, for a student from their primary guardian', () => {
    expect(personPaymentPrefills({ id: 't', roles: ['tutor'], guardians: [] })).toEqual([
      { key: 'tutor', title: 'Record a payment to them', params: { direction: 'to_tutor', party: 't' } },
    ]);
    expect(personPaymentPrefills({ id: 'p', roles: ['parent'], guardians: [] })[0]?.params).toEqual({
      direction: 'from_parent',
      party: 'p',
    });
    const guardians = [
      { user_id: 'a', full_name: 'A', email: null, relationship: 'mother' as const, is_primary: false },
      { user_id: 'b', full_name: 'B', email: null, relationship: 'father' as const, is_primary: true },
    ];
    expect(personPaymentPrefills({ id: 's', roles: ['student'], guardians })[0]?.params).toEqual({
      direction: 'from_parent',
      party: 'b',
      student: 's',
    });
    // Two guardians and neither primary: nobody to presume.
    expect(
      personPaymentPrefills({ id: 's', roles: ['student'], guardians: guardians.map((g) => ({ ...g, is_primary: false })) }),
    ).toEqual([]);
  });
});

describe('recordSections without Tutoring (Phase 50)', () => {
  it("drops availability, teaching, lessons, pay and a parent's payment", () => {
    const tutor = { ...base, roles: ['tutor' as const, 'parent' as const], tutor_profile: tutorProfile };
    expect(keys(recordSections(tutor, ADMIN, { tutoring: false }))).toEqual(['contact', 'background']);
    const student = { ...base, roles: ['student' as const], student_profile: studentProfile };
    expect(keys(recordSections(student, ADMIN, { tutoring: false }))).toEqual(['contact', 'school', 'family']);
    const parent = { ...base, roles: ['parent' as const] };
    expect(keys(recordSections(parent, ADMIN, { tutoring: false }))).toEqual(['contact']);
  });
});
