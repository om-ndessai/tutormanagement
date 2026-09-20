import { z } from 'zod';
import { formatTimeRange } from './teaching.js';
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
  /** Area only. The institute deliberately does not record street addresses. */
  area: optionalText(shortText(120, 'Area')),
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
});

export type TutorProfileInput = z.input<typeof tutorProfileSchema>;
export type TutorProfile = z.output<typeof tutorProfileSchema>;

/** Data that only means anything for a student. */
export const studentProfileSchema = z.object({
  school: optionalText(shortText(160, 'School')),
  /** The math course or grade they are currently enrolled in. */
  current_math_course: optionalText(shortText(160, 'Course')),
  /** What they are working towards this academic year. */
  academic_year_goal: optionalText(shortText(1000, 'Goal')),
  virtual_available: z.boolean().default(false),
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
  email: string;
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
  tutor_profile: tutorProfileSchema.nullish(),
  student_profile: studentProfileSchema.nullish(),
  payment_handles: paymentHandlesSchema.optional(),
  availability: availabilitySchema.optional(),
  guardians: guardianshipsSchema.optional(),
});

export type UpdateUserSectionsInput = z.input<typeof updateUserSectionsSchema>;
export type UpdateUserSectionsPayload = z.output<typeof updateUserSectionsSchema>;

/** Which profile section a role expects, for UI and validation. */
export const ROLE_PROFILE_TABLE: Partial<Record<UserRole, 'tutor_profile' | 'student_profile'>> = {
  tutor: 'tutor_profile',
  student: 'student_profile',
};

// ---------------------------------------------------------------------------
// Request bodies that combine a user with its sections
// ---------------------------------------------------------------------------
// Creating a student and naming their parent has to be one call: the rule
// "a student must have at least one parent" is unenforceable if the two are
// separate requests, because the student would exist parentless in between.

import { USER_STATUSES, userFieldsSchema } from './users.js';

const sectionShape = updateUserSectionsSchema.shape;

export const createUserRequestSchema = userFieldsSchema
  .extend({ status: z.enum(USER_STATUSES).default('active') })
  .extend(sectionShape);

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
  const { tutor_profile, student_profile, payment_handles, availability, guardians, ...user } =
    body;

  return {
    user: user as Omit<T, SectionKey>,
    sections: { tutor_profile, student_profile, payment_handles, availability, guardians },
  };
}
