import { z } from 'zod';

/**
 * Phase 1 covers staff only. Student / parent records get their own phase once
 * classes and scheduling exist.
 */
export const USER_ROLES = ['admin', 'tutor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * `invited` means the record exists but the person has not signed in yet. It is
 * already meaningful without auth: it marks staff who are being onboarded.
 */
export const USER_STATUSES = ['active', 'invited', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const USER_SORT_FIELDS = ['full_name', 'email', 'role', 'status', 'created_at'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

const email = z
  .email({ message: 'Enter a valid email address.' })
  .trim()
  .toLowerCase()
  .max(254);

const fullName = z
  .string()
  .trim()
  .min(1, 'Name is required.')
  .max(120, 'Name must be 120 characters or fewer.');

/**
 * Deliberately permissive: staff phone numbers get typed in every format under
 * the sun, and we only ever display them back.
 */
const phone = z
  .string()
  .trim()
  .max(32, 'Phone must be 32 characters or fewer.')
  .regex(/^[0-9+().\-\s]*$/, 'Phone may only contain digits and + ( ) - . characters.');

/** An optional free-text field that treats "" from a form as "not set". */
const optionalText = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([schema, z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value == null ? null : (value as string)));

/** Shape returned by the API. Mirrors the `users` table minus internal columns. */
export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
  created_at: z.string(),
  updated_at: z.string(),
  /** Set on every successful Google sign-in; null until they first sign in. */
  last_login_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;

/**
 * The writable fields, with no defaults applied. Kept separate because
 * `.partial()` does not remove a `.default()`: a PATCH body of `{}` would
 * otherwise parse to `{ status: 'active' }` and silently reactivate someone.
 */
const userFieldsSchema = z.object({
  email,
  full_name: fullName,
  phone: optionalText(phone),
  role: z.enum(USER_ROLES),
  status: z.enum(USER_STATUSES),
});

export const createUserSchema = userFieldsSchema.extend({
  status: z.enum(USER_STATUSES).default('active'),
});

export type CreateUserInput = z.input<typeof createUserSchema>;
export type CreateUserPayload = z.output<typeof createUserSchema>;

/**
 * PATCH semantics: an omitted key is left alone, so at least one key is
 * required. `phone: null` clears the value.
 */
export const updateUserSchema = userFieldsSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

export type UpdateUserInput = z.input<typeof updateUserSchema>;
export type UpdateUserPayload = z.output<typeof updateUserSchema>;

export const listUsersQuerySchema = z.object({
  /** Case-insensitive substring match against name and email. */
  search: z.string().trim().max(120).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  /** Include soft-deleted records in the result set. */
  include_deleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  sort: z.enum(USER_SORT_FIELDS).default('full_name'),
  order: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListUsersQuery = z.input<typeof listUsersQuerySchema>;
export type ListUsersParams = z.output<typeof listUsersQuerySchema>;

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  tutor: 'Tutor',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
};
