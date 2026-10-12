// Ported from apps/web/src/features/users/user-form-dialog.tsx (FormState, EMPTY, fromDetail,
// toRequest) @ 1132322 -- the pure half of the person form, so it can be tested on its own.
import {
  USER_ROLES,
  centsToInput,
  parseCentsInput,
  zonedClockParts,
  type AvailabilitySlot,
  type PaymentHandle,
  type UserDetail,
  type UserRole,
  type UserStatus,
} from '@tmi/shared';

export interface GuardianValue {
  guardian_user_id: string;
  relationship: 'mother' | 'father' | 'guardian' | 'other';
  is_primary: boolean;
}

/**
 * The blocks of the form, so a caller can show only some of them -- the welcome wizard (#34)
 * walks a new tutor through their background, then their financials, then their availability,
 * one block at a time. Hidden blocks keep their values: the request is always built from the
 * whole form, so an edit scoped to one block never clears another.
 */
export const USER_FORM_SECTIONS = [
  'identity',
  'roles',
  'admin',
  'tutor-background',
  'tutor-financials',
  'tutor-availability',
  'student',
  'availability',
  'payment-handles',
  'guardians',
] as const;
export type UserFormSection = (typeof USER_FORM_SECTIONS)[number];

export interface FormState {
  email: string;
  full_name: string;
  phone: string;
  status: UserStatus;
  roles: UserRole[];
  tutor: {
    highest_education: string;
    school: string;
    area: string;
    address_line1: string;
    address_line2: string;
    city: string;
    state: string;
    postal_code: string;
    availability_notes: string;
    virtual_available: boolean;
    /** Dollars as typed; converted to cents on submit. */
    rate_in_person: string;
    rate_virtual: string;
    /** Minutes, or "" for "no limit of their own". */
    max_minutes: string;
    /** Dollars as typed; "" means this tutor is not paid in advance. */
    topup: string;
    /** Whether the office holds this tutor's SSN. A tick, never the number. */
    ssn_received: boolean;
    /** The date already recorded, kept so a tick does not re-date it. */
    ssn_received_on: string | null;
  };
  student: {
    school: string;
    current_math_course: string;
    academic_year_goal: string;
    virtual_available: boolean;
    /** Dollars as typed; converted to cents on submit. */
    charge_in_person: string;
    charge_virtual: string;
    /** Minutes, or "" for "no limit of their own". */
    max_minutes: string;
  };
  payment_handles: PaymentHandle[];
  availability: AvailabilitySlot[];
  guardians: GuardianValue[];
}

export const EMPTY: FormState = {
  email: '',
  full_name: '',
  phone: '',
  status: 'active',
  roles: [],
  tutor: {
    highest_education: '',
    school: '',
    area: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    availability_notes: '',
    virtual_available: false,
    rate_in_person: '',
    rate_virtual: '',
    max_minutes: '',
    topup: '',
    ssn_received: false,
    ssn_received_on: null,
  },
  student: {
    school: '',
    current_math_course: '',
    academic_year_goal: '',
    virtual_available: false,
    charge_in_person: '',
    charge_virtual: '',
    max_minutes: '',
  },
  payment_handles: [],
  availability: [],
  guardians: [],
};

export function fromDetail(detail: UserDetail): FormState {
  const tutor = detail.tutor_profile;
  const student = detail.student_profile;
  return {
    email: detail.email ?? '',
    full_name: detail.full_name,
    phone: detail.phone ?? '',
    status: detail.status,
    roles: detail.roles,
    tutor: {
      highest_education: tutor?.highest_education ?? '',
      school: tutor?.school ?? '',
      area: tutor?.area ?? '',
      address_line1: tutor?.address_line1 ?? '',
      address_line2: tutor?.address_line2 ?? '',
      city: tutor?.city ?? '',
      state: tutor?.state ?? '',
      postal_code: tutor?.postal_code ?? '',
      availability_notes: tutor?.availability_notes ?? '',
      virtual_available: tutor?.virtual_available ?? false,
      rate_in_person: centsToInput(tutor?.default_rate_in_person_cents),
      rate_virtual: centsToInput(tutor?.default_rate_virtual_cents),
      max_minutes: tutor?.max_session_minutes?.toString() ?? '',
      topup: centsToInput(tutor?.topup_amount_cents),
      ssn_received: Boolean(tutor?.ssn_received_on),
      ssn_received_on: tutor?.ssn_received_on ?? null,
    },
    student: {
      school: student?.school ?? '',
      current_math_course: student?.current_math_course ?? '',
      academic_year_goal: student?.academic_year_goal ?? '',
      virtual_available: student?.virtual_available ?? false,
      charge_in_person: centsToInput(student?.charge_rate_in_person_cents),
      charge_virtual: centsToInput(student?.charge_rate_virtual_cents),
      max_minutes: student?.max_session_minutes?.toString() ?? '',
    },
    payment_handles: detail.payment_handles,
    availability: detail.availability,
    guardians: detail.guardians.map((link) => ({
      guardian_user_id: link.user_id,
      relationship: link.relationship,
      is_primary: link.is_primary,
    })),
  };
}

/** Today on the organization's clock, for the date an SSN confirmation is recorded. */
export function todayIso(timeZone: string, now: Date = new Date()): string {
  return zonedClockParts(now.toISOString(), timeZone).day;
}

/**
 * Builds the request body. Role-specific sections are sent as null when the role is not held,
 * which is what tells the API to drop that profile row -- the schema's rule is that a profile
 * exists only while its role does.
 */
export function toRequest(form: FormState, today: string) {
  const isTutor = form.roles.includes('tutor');
  const isStudent = form.roles.includes('student');

  return {
    email: form.email,
    full_name: form.full_name,
    phone: form.phone,
    status: form.status,
    roles: form.roles,
    tutor_profile: isTutor
      ? {
          highest_education: form.tutor.highest_education,
          school: form.tutor.school,
          area: form.tutor.area,
          address_line1: form.tutor.address_line1,
          address_line2: form.tutor.address_line2,
          city: form.tutor.city,
          state: form.tutor.state,
          postal_code: form.tutor.postal_code,
          availability_notes: form.tutor.availability_notes,
          virtual_available: form.tutor.virtual_available,
          default_rate_in_person_cents: parseCentsInput(form.tutor.rate_in_person),
          default_rate_virtual_cents: parseCentsInput(form.tutor.rate_virtual),
          max_session_minutes: form.tutor.max_minutes ? Number(form.tutor.max_minutes) : null,
          topup_amount_cents: parseCentsInput(form.tutor.topup),
          // A tick sets today and keeps whatever date was already recorded, so editing an
          // unrelated field never silently re-dates it.
          ssn_received_on: form.tutor.ssn_received ? (form.tutor.ssn_received_on ?? today) : null,
        }
      : null,
    student_profile: isStudent
      ? {
          school: form.student.school,
          current_math_course: form.student.current_math_course,
          academic_year_goal: form.student.academic_year_goal,
          virtual_available: form.student.virtual_available,
          charge_rate_in_person_cents: parseCentsInput(form.student.charge_in_person),
          charge_rate_virtual_cents: parseCentsInput(form.student.charge_virtual),
          max_session_minutes: form.student.max_minutes ? Number(form.student.max_minutes) : null,
        }
      : null,
    payment_handles: form.payment_handles,
    // Availability only means something for someone who teaches or learns.
    availability: isTutor || isStudent ? form.availability : [],
    guardians: form.guardians,
  };
}

/** `?sections=tutor-background,tutor-financials` -> the known ones; undefined shows every block. */
export function parseSections(param: string | undefined): UserFormSection[] | undefined {
  if (!param) return undefined;
  const known = param
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is UserFormSection => (USER_FORM_SECTIONS as readonly string[]).includes(part));
  return known.length > 0 ? known : undefined;
}

/** `?preset=student,tutor` -> the known roles. */
export function parsePreset(param: string | undefined): UserRole[] {
  if (!param) return [];
  return USER_ROLES.filter((role) =>
    param
      .split(',')
      .map((part) => part.trim())
      .includes(role),
  );
}

/** The payment block's hint, from the web's three. */
export function handlesHint(roles: readonly UserRole[]): string {
  const isTutor = roles.includes('tutor');
  const isParent = roles.includes('parent');
  if (isTutor && isParent) return 'Used both to pay them as a tutor and to bill them as a parent.';
  return isTutor ? 'How this tutor is paid.' : 'How this parent is billed.';
}

/** Adds a guardian link: the first one added becomes the primary contact. */
export function addGuardian(links: GuardianValue[], guardianUserId: string): GuardianValue[] {
  if (links.some((link) => link.guardian_user_id === guardianUserId)) return links;
  return [
    ...links,
    { guardian_user_id: guardianUserId, relationship: 'guardian', is_primary: links.length === 0 },
  ];
}

/** Changes one link; marking one primary unmarks the others (only one may be). */
export function updateGuardian(
  links: GuardianValue[],
  id: string,
  patch: Partial<GuardianValue>,
): GuardianValue[] {
  return links.map((link) =>
    link.guardian_user_id === id
      ? { ...link, ...patch }
      : patch.is_primary
        ? { ...link, is_primary: false }
        : link,
  );
}

/** Removes a link, and never leaves the rest with nobody marked primary. */
export function removeGuardian(links: GuardianValue[], id: string): GuardianValue[] {
  const remaining = links.filter((link) => link.guardian_user_id !== id);
  if (remaining.length > 0 && !remaining.some((link) => link.is_primary)) {
    remaining[0] = { ...remaining[0]!, is_primary: true };
  }
  return remaining;
}

/** Sets or clears one payment id: at most one per method. */
export function setHandle(
  handles: PaymentHandle[],
  method: PaymentHandle['method'],
  handle: string,
): PaymentHandle[] {
  const rest = handles.filter((entry) => entry.method !== method);
  const trimmed = handle.trim();
  return trimmed ? [...rest, { method, handle: trimmed }] : rest;
}
