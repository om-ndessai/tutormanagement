import { z } from 'zod';
import {
  MAX_SESSION_MINUTES_LIMIT,
  QUARTER_HOUR,
  formatTimeRange,
} from './teaching.js';
import { optionalText, userSchema, type UserRole } from './users.js';

// ---------------------------------------------------------------------------
// Role-specific profiles
// ---------------------------------------------------------------------------

const shortText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

/** A money field that treats "" from a form as "not set". */
const optionalCentsField = z
  .union([z.number().int().min(0).max(100_000_00), z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value == null ? null : (value as number)));

/**
 * The longest a single lesson may run, in minutes. "" from a form means "no
 * limit of their own", which defers to the other party's.
 */
const optionalMaxSessionMinutesField = z
  .union([
    z
      .number()
      .int('Use a whole number of minutes.')
      .min(QUARTER_HOUR, 'The shortest session the institute records is 15 minutes.')
      .max(MAX_SESSION_MINUTES_LIMIT, 'A single session cannot run longer than eight hours.')
      .refine((value) => value % QUARTER_HOUR === 0, 'Use a multiple of 15 minutes.'),
    z.literal(''),
  ])
  .nullish()
  .transform((value) => (value === '' || value == null ? null : (value as number)));

/**
 * Data that only means anything for a tutor. Exists only while the person
 * holds the tutor role.
 */
export const tutorProfileSchema = z.object({
  /**
   * Highest education reached -- or, for a tutor still at school, their current
   * grade or math course. One free-text field because the plan treats them as
   * interchangeable.
   */
  highest_education: optionalText(shortText(160, 'Education')),
  school: optionalText(shortText(160, 'School')),
  /** The neighbourhood, for matching tutors to families. Not the address below. */
  area: optionalText(shortText(120, 'Area')),
  /**
   * The tutor's mailing address, for their year-end 1099-NEC. Only an admin
   * and the tutor themselves may read it (scopePersonalDetails). Every part is
   * optional -- a tutor is recorded before their paperwork is -- but a 1099
   * needs all of them, which the year-end panel points out.
   */
  address_line1: optionalText(shortText(160, 'Street address')),
  address_line2: optionalText(shortText(160, 'Address line 2')),
  city: optionalText(shortText(80, 'City')),
  state: z
    .union([
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, 'Use the two-letter state code, like NC.'),
      z.literal(''),
    ])
    .nullish()
    .transform((value) => (value === '' || value == null ? null : (value as string))),
  postal_code: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\d{5}(-\d{4})?$/, 'Use a ZIP code like 27513 or 27513-1234.'),
      z.literal(''),
    ])
    .nullish()
    .transform((value) => (value === '' || value == null ? null : (value as string))),
  /** Free-text caveats on the structured availability slots. */
  availability_notes: optionalText(shortText(1000, 'Notes')),
  /** Whether this tutor will teach online as well as in person. */
  virtual_available: z.boolean().default(false),
  /**
   * Default hourly rates in whole cents. A per-student override on the
   * assignment beats these; see resolveRateCents in teaching.ts.
   */
  default_rate_in_person_cents: optionalCentsField,
  default_rate_virtual_cents: optionalCentsField,
  /**
   * The longest lesson this tutor teaches. The SHORTER of this and the
   * student's limit ends a live session that reaches it; see
   * effectiveMaxSessionMinutes.
   */
  max_session_minutes: optionalMaxSessionMinutesField,
  /**
   * The level the institute keeps this tutor's advance above. Blank means the
   * tutor is not on an advance at all. Only an admin may set it -- see the
   * users route -- and only an admin or the tutor themselves may read it.
   */
  topup_amount_cents: optionalCentsField,
  /**
   * The date the office confirmed it holds this tutor's SSN, or null when it
   * does not and no tax document can be issued. The number itself is never
   * stored, sent or asked for by this portal.
   */
  ssn_received_on: z
    .union([z.iso.date({ message: 'Use a date like 2026-01-31.' }), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value == null ? null : (value as string))),
});

export type TutorProfileInput = z.input<typeof tutorProfileSchema>;
export type TutorProfile = z.output<typeof tutorProfileSchema>;

/** The parts of a mailing address, as a tutor profile holds them. */
export interface MailingAddressParts {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
}

/** The address fields, blank, for hiding them from a reader who may not see them. */
export const EMPTY_MAILING_ADDRESS: MailingAddressParts = {
  address_line1: null,
  address_line2: null,
  city: null,
  state: null,
  postal_code: null,
};

/**
 * "12 Oak St\nApt 4\nCary, NC 27513", or null when nothing is recorded.
 * Lines that are missing are left out rather than printed blank.
 */
export function formatMailingAddress(parts: MailingAddressParts): string | null {
  const place = [parts.city, [parts.state, parts.postal_code].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ');
  const lines = [parts.address_line1, parts.address_line2, place].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
}

/** Whether every part a 1099 needs is present (line 2 is optional). */
export function isMailingAddressComplete(parts: MailingAddressParts): boolean {
  return Boolean(parts.address_line1 && parts.city && parts.state && parts.postal_code);
}

/**
 * Data that only means anything for an admin: the taxpayer identification
 * number the institute files its 1099s under.
 *
 * Runs through optionalText like every other free-text field, which means the
 * SSN guard applies to it too. That is deliberate rather than incidental: a
 * sole proprietor may well file under their own Social Security number, and
 * this portal does not keep one whatever the field is called.
 */
export const adminProfileSchema = z.object({
  tin: optionalText(shortText(40, 'TIN')),
});

export type AdminProfileInput = z.input<typeof adminProfileSchema>;
export type AdminProfile = z.output<typeof adminProfileSchema>;

/** Data that only means anything for a student. */
export const studentProfileSchema = z.object({
  school: optionalText(shortText(160, 'School')),
  /** The math course or grade they are currently enrolled in. */
  current_math_course: optionalText(shortText(160, 'Course')),
  /** What they are working towards this academic year. */
  academic_year_goal: optionalText(shortText(1000, 'Goal')),
  virtual_available: z.boolean().default(false),
  /**
   * Hourly rates the institute CHARGES this student's family, in whole cents.
   * Separate from what the tutor is paid; the institute keeps the difference.
   * Only an admin may set these -- see the users route.
   */
  charge_rate_in_person_cents: optionalCentsField,
  charge_rate_virtual_cents: optionalCentsField,
  /** The longest lesson this student sits. See the tutor's field. */
  max_session_minutes: optionalMaxSessionMinutesField,
});

export type StudentProfileInput = z.input<typeof studentProfileSchema>;
export type StudentProfile = z.output<typeof studentProfileSchema>;

// ---------------------------------------------------------------------------
// Payment handles
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = ['zelle', 'venmo'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  zelle: 'Zelle',
  venmo: 'Venmo',
};

/**
 * How money reaches or leaves a person: tutors are paid through these, parents
 * are billed through them. Belongs to the PERSON, so someone who both tutors
 * and parents has one handle rather than two that can disagree.
 */
export const paymentHandleSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  /** Phone, email or @username, depending on the service. */
  handle: z.string().trim().min(1, 'Enter the id.').max(160),
});

export type PaymentHandle = z.infer<typeof paymentHandleSchema>;

/** At most one handle per method, matching the table's composite key. */
export const paymentHandlesSchema = z
  .array(paymentHandleSchema)
  .max(PAYMENT_METHODS.length)
  .refine(
    (handles) => new Set(handles.map((h) => h.method)).size === handles.length,
    { message: 'Only one id per payment method.' },
  );

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** 0 = Sunday .. 6 = Saturday, matching JS Date#getDay(). */
export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

/**
 * One hour block: (day_of_week, hour) means that day from `hour`:00 to
 * `hour`+1:00. Required by tutors and students alike, so it is keyed on the
 * person -- someone who both tutors and studies is free at one set of times.
 */
export const availabilitySlotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
});

export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

export const availabilitySchema = z
  .array(availabilitySlotSchema)
  .max(7 * 24)
  .refine(
    (slots) => new Set(slots.map((s) => `${s.day_of_week}-${s.hour}`)).size === slots.length,
    { message: 'The same hour was selected twice.' },
  );

/** "Tue 4:00–5:00 PM" */
export function formatSlot(slot: AvailabilitySlot): string {
  const day = DAYS_OF_WEEK[slot.day_of_week]?.short ?? '?';
  return `${day} ${formatTimeRange(slot.hour * 60, (slot.hour + 1) * 60)}`;
}

/** Collapses consecutive hours on the same day into "Tue 4:00–6:00 PM". */
export function groupSlotsByDay(
  slots: AvailabilitySlot[],
): { day_of_week: number; ranges: { start: number; end: number }[] }[] {
  const byDay = new Map<number, number[]>();

  for (const slot of slots) {
    const hours = byDay.get(slot.day_of_week) ?? [];
    hours.push(slot.hour);
    byDay.set(slot.day_of_week, hours);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([day_of_week, hours]) => {
      const sorted = [...hours].sort((a, b) => a - b);
      const ranges: { start: number; end: number }[] = [];

      for (const hour of sorted) {
        const last = ranges.at(-1);
        // Extend the open range when this hour starts where the last one ended.
        if (last && last.end === hour) last.end = hour + 1;
        else ranges.push({ start: hour, end: hour + 1 });
      }

      return { day_of_week, ranges };
    });
}

// ---------------------------------------------------------------------------
// Guardianships
// ---------------------------------------------------------------------------

export const RELATIONSHIPS = ['mother', 'father', 'guardian', 'other'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  mother: 'Mother',
  father: 'Father',
  guardian: 'Guardian',
  other: 'Other',
};

/**
 * One user is responsible for another. Used both for a student's parents and
 * for a minor tutor's parent -- the plan needs both, and they are the same
 * shape.
 */
export const guardianshipInputSchema = z.object({
  guardian_user_id: z.uuid(),
  relationship: z.enum(RELATIONSHIPS).default('guardian'),
  is_primary: z.boolean().default(false),
});

export type GuardianshipInput = z.input<typeof guardianshipInputSchema>;

export const guardianshipsSchema = z
  .array(guardianshipInputSchema)
  .max(4)
  .refine(
    (links) => new Set(links.map((l) => l.guardian_user_id)).size === links.length,
    { message: 'The same person was added twice.' },
  )
  .refine((links) => links.filter((l) => l.is_primary).length <= 1, {
    message: 'Only one guardian can be the primary contact.',
  });

/** A guardianship as returned by the API, with the other person resolved. */
export interface GuardianLink {
  user_id: string;
  full_name: string;
  /** NULL for a child with no address of their own. */
  email: string | null;
  relationship: Relationship;
  is_primary: boolean;
}

// ---------------------------------------------------------------------------
// The complete picture of one person
// ---------------------------------------------------------------------------

/**
 * Everything the portal knows about a user, assembled from `users` plus the
 * tables that hang off it. Sections are null/empty when the person does not
 * hold the corresponding role.
 */
export interface UserDetail extends z.infer<typeof userSchema> {
  /** Present while the admin role is held. Only admins may read it. */
  admin_profile: AdminProfile | null;
  tutor_profile: TutorProfile | null;
  student_profile: StudentProfile | null;
  payment_handles: PaymentHandle[];
  availability: AvailabilitySlot[];
  /** People responsible for this user (their parents). */
  guardians: GuardianLink[];
  /** People this user is responsible for (their children). */
  dependents: GuardianLink[];
}

/**
 * PATCH body for the sections that hang off a user. Every key is optional;
 * supplying one REPLACES that whole section, which keeps "set my availability"
 * a single idempotent call instead of a diff.
 */
export const updateUserSectionsSchema = z.object({
  /** null removes the profile, e.g. when the tutor role is dropped. */
  admin_profile: adminProfileSchema.nullish(),
  tutor_profile: tutorProfileSchema.nullish(),
  student_profile: studentProfileSchema.nullish(),
  payment_handles: paymentHandlesSchema.optional(),
  availability: availabilitySchema.optional(),
  guardians: guardianshipsSchema.optional(),
});

export type UpdateUserSectionsInput = z.input<typeof updateUserSectionsSchema>;
export type UpdateUserSectionsPayload = z.output<typeof updateUserSectionsSchema>;

/** Which profile section a role expects, for UI and validation. */
export const ROLE_PROFILE_TABLE: Partial<
  Record<UserRole, 'admin_profile' | 'tutor_profile' | 'student_profile'>
> = {
  admin: 'admin_profile',
  tutor: 'tutor_profile',
  student: 'student_profile',
};

// ---------------------------------------------------------------------------
// Request bodies that combine a user with its sections
// ---------------------------------------------------------------------------
// Creating a student and naming their parent has to be one call: the rule
// "a student must have at least one parent" is unenforceable if the two are
// separate requests, because the student would exist parentless in between.

import { USER_STATUSES, refineEmailForRoles, userFieldsSchema } from './users.js';

const sectionShape = updateUserSectionsSchema.shape;

export const createUserRequestSchema = userFieldsSchema
  .extend({ status: z.enum(USER_STATUSES).default('active') })
  .extend(sectionShape)
  // The same rule the standalone createUserSchema carries: this is the shape
  // the route actually validates, and the form checks before submitting.
  .superRefine(refineEmailForRoles);

export type CreateUserRequestInput = z.input<typeof createUserRequestSchema>;
export type CreateUserRequestPayload = z.output<typeof createUserRequestSchema>;

export const updateUserRequestSchema = userFieldsSchema
  .partial()
  .extend(sectionShape)
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type UpdateUserRequestInput = z.input<typeof updateUserRequestSchema>;
export type UpdateUserRequestPayload = z.output<typeof updateUserRequestSchema>;

type SectionKey = keyof UpdateUserSectionsPayload;

/**
 * Splits a combined request body into the `users` row and the sections that
 * hang off it, so a route can hand each to the right repository call while
 * keeping both fully typed.
 */
export function splitUserRequest<T extends Partial<UpdateUserSectionsPayload>>(
  body: T,
): { user: Omit<T, SectionKey>; sections: UpdateUserSectionsPayload } {
  const {
    admin_profile,
    tutor_profile,
    student_profile,
    payment_handles,
    availability,
    guardians,
    ...user
  } =
    body;

  return {
    user: user as Omit<T, SectionKey>,
    sections: {
      admin_profile,
      tutor_profile,
      student_profile,
      payment_handles,
      availability,
      guardians,
    },
  };
}
