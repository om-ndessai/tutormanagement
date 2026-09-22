import { z } from 'zod';

/**
 * The four kinds of person the portal serves. A user holds one OR MORE of
 * these at once -- a parent who tutors, an admin who teaches, a senior student
 * who tutors younger children. That is why roles are a set, not a field.
 */
export const USER_ROLES = ['admin', 'tutor', 'student', 'parent'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * `invited` means the record exists but the person has never signed in.
 * `suspended` means access is revoked while the record is kept. Retiring
 * someone entirely is a soft delete, which is separate.
 */
export const USER_STATUSES = ['active', 'invited', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Roles are multi-valued, so they are not a sort key. */
export const USER_SORT_FIELDS = ['full_name', 'email', 'status', 'created_at'] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/**
 * Any Google-backed address is accepted. Google sign-in is what proves the
 * account is real, so no domain is hard-coded here -- that would shut out the
 * institute's own Workspace addresses later.
 */
const email = z
  .email({ message: 'Enter a valid email address.' })
  .trim()
  .toLowerCase()
  .max(254);

/**
 * The same address, optional. "" from a form means "no address at all", which
 * is the ordinary case for a child.
 */
const optionalEmail = z
  .union([email, z.literal('')])
  .nullish()
  .transform((value) => (value === '' || value == null ? null : (value as string)));

/**
 * Whether this set of roles obliges someone to have an email address.
 *
 * Everything except being a student involves signing in, and sign-in matches
 * on email -- so an admin, tutor or parent without one could never get in. A
 * student who only learns here never signs in: their parents read their
 * dashboard from their own login.
 */
export function requiresEmail(roles: readonly UserRole[]): boolean {
  return roles.some((role) => role !== 'student');
}

/** The message shown when somebody who must have an address has none. */
export const EMAIL_REQUIRED_MESSAGE =
  'An email address is required for anyone who signs in. Only a student who holds no other role may be left without one.';

const fullName = z
  .string()
  .trim()
  .min(1, 'Name is required.')
  .max(120, 'Name must be 120 characters or fewer.');

/** Permissive: phone numbers get typed in every format, and we only display them. */
const phone = z
  .string()
  .trim()
  .max(32, 'Phone must be 32 characters or fewer.')
  .regex(/^[0-9+().\-\s]*$/, 'Phone may only contain digits and + ( ) - . characters.');

/** An optional free-text field that treats "" from a form as "not set". */
export const optionalText = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([schema, z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value == null ? null : (value as string)));

export const userSchema = z.object({
  id: z.uuid(),
  /** NULL for somebody with no address -- a child who never signs in. */
  email: z.string().nullable(),
  full_name: z.string(),
  phone: z.string().nullable(),
  status: z.enum(USER_STATUSES),
  /** Every role this person holds. Always at least one. */
  roles: z.array(z.enum(USER_ROLES)),
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;

/** At least one role: a user with no role has no reason to exist. */
const roles = z
  .array(z.enum(USER_ROLES))
  .min(1, 'Choose at least one role.')
  .transform((value) => [...new Set(value)]);

/**
 * Writable fields with no defaults applied. Kept separate because `.partial()`
 * does not remove a `.default()`: a PATCH body of `{}` would otherwise parse to
 * `{ status: 'active' }` and silently reactivate someone.
 */
export const userFieldsSchema = z.object({
  email: optionalEmail,
  full_name: fullName,
  phone: optionalText(phone),
  roles,
  status: z.enum(USER_STATUSES),
});

/**
 * The "who may have no address" rule, as a refinement.
 *
 * Applied to every schema that carries an email and a whole role set, so the
 * form and the route reject the same thing and the browser can say so inline.
 * A PATCH carries neither reliably -- it may move the roles without the email
 * or the other way about -- so the route re-checks the combination against
 * what is already stored; see assertEmailPresentIfNeeded there.
 */
export function refineEmailForRoles(
  value: { email: string | null; roles: readonly UserRole[] },
  ctx: z.RefinementCtx,
) {
  if (value.email === null && requiresEmail(value.roles)) {
    ctx.addIssue({ code: 'custom', path: ['email'], message: EMAIL_REQUIRED_MESSAGE });
  }
}

export const createUserSchema = userFieldsSchema
  .extend({
    status: z.enum(USER_STATUSES).default('active'),
  })
  .superRefine(refineEmailForRoles);

export type CreateUserInput = z.input<typeof createUserSchema>;
export type CreateUserPayload = z.output<typeof createUserSchema>;

/**
 * PATCH semantics: an omitted key is left alone. Supplying `roles` REPLACES the
 * whole set rather than adding to it.
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
  /** Matches users who hold this role, among others. */
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
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
  student: 'Student',
  parent: 'Parent',
};

/** One-line explanation of each role, for form hints. */
export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Owns the institute or has admin access. Only admins can add users.',
  tutor: 'Offers tutoring services.',
  student: 'Enrolled for tutoring. Must have at least one parent.',
  parent: 'Responsible for costs, communication and monitoring.',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
};

export function hasRole(user: Pick<User, 'roles'>, role: UserRole): boolean {
  return user.roles.includes(role);
}
