import { z } from 'zod';
import { refuseSsn } from './tax.js';

/**
 * The four kinds of person the portal serves. A user holds one OR MORE of
 * these at once -- a parent who tutors, an admin who teaches, a senior student
 * who tutors younger children. That is why roles are a set, not a field.
 *
 * Phase 79 (docs/members-plan.md, M1): the set may also be EMPTY. A person in a
 * space with no role is a MEMBER: they play Quest there, and the space's admins
 * give them a role whenever they like, under that role's rules.
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
 * dashboard from their own login. A member (no role, Phase 79) is here to play,
 * which means signing in, so they need one too.
 */
export function requiresEmail(roles: readonly UserRole[]): boolean {
  return roles.length === 0 || roles.some((role) => role !== 'student');
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

/**
 * An optional free-text field that treats "" from a form as "not set".
 *
 * Every free-text field in the portal is built from this, which is why the
 * SSN guard lives here: "we never store a Social Security number" has to mean
 * one cannot be typed into a note or a comment either, not merely that no
 * column is named after it.
 */
export const optionalText = <T extends z.ZodType<string>>(schema: T) =>
  z
    .union([refuseSsn(schema), z.literal('')])
    .nullish()
    .transform((value) => (value === '' || value == null ? null : (value as string)));

export const userSchema = z.object({
  id: z.uuid(),
  /** NULL for somebody with no address -- a child who never signs in. */
  email: z.string().nullable(),
  full_name: z.string(),
  phone: z.string().nullable(),
  status: z.enum(USER_STATUSES),
  /** Every role this person holds. Empty for a member (Phase 79). */
  roles: z.array(z.enum(USER_ROLES)),
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export type User = z.infer<typeof userSchema>;

/** The roles held, each once. Empty is a member (Phase 79, M1): in the space, with no role yet. */
const roles = z.array(z.enum(USER_ROLES)).transform((value) => [...new Set(value)]);

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
  /** Matches users who hold this role, among others; `member` matches those who hold none (Phase 79). */
  role: z.enum([...USER_ROLES, 'member']).optional(),
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
  admin: 'Runs the space. Only admins can add people.',
  tutor: 'Offers tutoring services.',
  student: 'Enrolled for tutoring. Must have at least one parent.',
  parent: 'Responsible for costs, communication and monitoring.',
};

/** Phase 79 (M1): what a person with no role is called on screen. */
export const MEMBER_LABEL = 'Member';

/** One line beside the roles, for a person who holds none. */
export const MEMBER_DESCRIPTION = 'In the space with no role yet: plays Quest here. Give them a role whenever you like.';

/** Phase 79 (M6): what the Assessment page says to a member of a shared space, in place of a start card. */
export const MEMBER_ASSESSMENTS_LINE = 'Assessments here are for students.';

/** A person's roles for a screen: "Admin · Tutor", or "Member" when they hold none. */
export function rolesLabel(roles: readonly UserRole[], separator = ' · '): string {
  return roles.length === 0 ? MEMBER_LABEL : roles.map((role) => USER_ROLE_LABELS[role]).join(separator);
}

/**
 * A person's roles for a log line, exactly as the lines have always printed them ("admin and tutor"), or "a
 * member" when they hold none -- old lines are never rewritten, so a non-empty set must read as before.
 */
export function rolesInWords(roles: readonly UserRole[]): string {
  return roles.length === 0 ? 'a member' : roles.join(' and ');
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
};

/**
 * Phase 76 (JF21): what each status means, said beside the choice on both clients. "Invited" is
 * how an existing account is always added (it accepts by hand), so the words say so rather than
 * letting "Active" look like a way round it.
 */
export const USER_STATUS_DESCRIPTIONS: Record<UserStatus, string> = {
  active: 'In the space now.',
  invited: 'They join when they sign in -- someone who already has an account always accepts by hand.',
  suspended: 'Kept on the books, but cannot open the space.',
};

export function hasRole(user: Pick<User, 'roles'>, role: UserRole): boolean {
  return user.roles.includes(role);
}
