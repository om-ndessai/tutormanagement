import { Hono } from 'hono';
import { z } from 'zod';
import {
  EMAIL_REQUIRED_MESSAGE,
  createUserRequestSchema,
  listUsersQuerySchema,
  requiresEmail,
  ssnReceiptSchema,
  splitUserRequest,
  updateUserRequestSchema,
  type ApiList,
  type ApiOk,
  type GuardianshipInput,
  type User,
  type UserDetail,
  type UserRole,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { describeChangedFields, recordAudit } from '../lib/audit.js';
import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { zValidator } from '../lib/validate.js';
import type { OrgId } from '../lib/org.js';
import {
  isAdmin,
  scopeStudentCharges,
  scopePersonalDetails,
  scopeTutorPay,
  scopeTutorTopup,
  visibleUserIds,
} from '../lib/scope.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
  belongsElsewhere,
  countGuardians,
  createUser,
  deactivateUser,
  findMissingUserIds,
  getUserById,
  getUserDetail,
  setSsnReceived,
  listUsers,
  purgeUser,
  restoreUser,
  updateUser,
  updateUserSections,
} from '../repositories/users.js';

const idParamSchema = z.object({
  id: z.uuid({ message: 'Not a valid user id.' }),
});

const deleteQuerySchema = z.object({
  /** `hard=true` removes the row instead of soft-deleting it. */
  hard: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const EMAIL_TAKEN = 'Someone in this organization already has that email address.';

/**
 * The shared fields of a person who belongs to another organization as well.
 * One organization changing them would change them for every other -- and an
 * email is the sign-in identity, so changing it would hand the account over.
 */
const SHARED_FIELDS = ['full_name', 'email', 'phone'] as const;
const SHARED_FIELDS_LOCKED =
  'This person belongs to another organization too, so their name, email and phone are ' +
  'shared. A platform administrator changes them.';

/**
 * "A student must have atleast one parent relationship." -- docs/plan.md.
 *
 * This cannot be a database constraint: the student row must exist before any
 * guardianship can point at it, so no CHECK or foreign key can express it. It
 * lives here instead, and is checked on every write that could break it.
 */
function assertStudentHasGuardian(roles: UserRole[], guardianCount: number) {
  if (roles.includes('student') && guardianCount === 0) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      guardians: ['A student must have at least one parent or guardian.'],
    });
  }
}

/**
 * "Only a student who holds no other role may be left without an email."
 *
 * The database cannot see this one either: the address is on `users` and the
 * roles are rows in `user_roles`, and a PATCH may move either side. Both are
 * resolved to their post-update values before it is checked -- taking the
 * address off somebody and making them a tutor in one request has to fail as
 * surely as doing it in two.
 *
 * Sign-in matches on email, so the rule is really "nobody who signs in may be
 * without a way to sign in".
 */
function assertEmailPresentIfNeeded(roles: UserRole[], email: string | null) {
  if (email === null && requiresEmail(roles)) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      email: [EMAIL_REQUIRED_MESSAGE],
    });
  }
}

/** Guardian ids come from the client, so they are checked before they hit a FK. */
async function assertGuardiansExist(
  db: D1Database,
  org: OrgId,
  dependentId: string | null,
  guardians: GuardianshipInput[] | undefined,
) {
  if (!guardians || guardians.length === 0) return;

  const ids = guardians.map((link) => link.guardian_user_id);

  if (dependentId && ids.includes(dependentId)) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      guardians: ['Someone cannot be their own parent or guardian.'],
    });
  }

  // Members of THIS organization: a guardian elsewhere is no guardian here.
  const missing = await findMissingUserIds(db, org, ids);

  if (missing.length > 0) {
    throw ApiError.validation('Please correct the highlighted fields.', {
      guardians: [`${missing.length} selected guardian(s) no longer exist.`],
    });
  }
}

export const usersRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listUsersQuerySchema), async (c) => {
    const params = c.req.valid('query');
    // Non-admins see only the people they work with; see lib/scope.ts.
    const viewer = c.get('user');
    const org = c.get('org').id;
    const visible = await visibleUserIds(c.env.DB, org, viewer);
    // Retired people are an admin's concern: nobody else may ask for them.
    const { users, total } = await listUsers(
      c.env.DB,
      org,
      visible ? { ...params, include_deleted: false } : params,
      visible,
    );

    const body: ApiList<User> = {
      // When somebody else last signed in is the office's business, not a
      // colleague's or a family's.
      data: visible
        ? users.map((row) => (row.id === viewer.id ? row : { ...row, last_login_at: null }))
        : users,
      meta: { total, limit: params.limit, offset: params.offset },
    };
    return c.json(body);
  })

  /**
   * Creating the user and its sections is one call so that a student is never
   * briefly parentless -- see assertStudentHasGuardian.
   */
  .post('/', requireAdmin, zValidator('json', createUserRequestSchema), async (c) => {
    const { user: fields, sections } = splitUserRequest(c.req.valid('json'));
    const org = c.get('org').id;

    assertStudentHasGuardian(fields.roles, sections.guardians?.length ?? 0);
    await assertGuardiansExist(c.env.DB, org, null, sections.guardians);

    let outcome: Awaited<ReturnType<typeof createUser>>;

    try {
      outcome = await createUser(c.env.DB, org, fields);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw ApiError.conflict(EMAIL_TAKEN);
      throw error;
    }

    if (outcome.kind === 'already_member') throw ApiError.conflict(EMAIL_TAKEN);
    const created = outcome.user;

    await updateUserSections(c.env.DB, org, created.id, sections);

    // Someone who already had an account is INVITED: they accept when they
    // next sign in. The answer to the caller is the same either way, so it
    // says nothing about whether the address had an account.
    await recordAudit(c.env.DB, c.get('user'), org, {
      action: outcome.kind === 'invited' ? 'membership.invited' : 'user.created',
      description:
        outcome.kind === 'invited'
          ? `Invited ${created.full_name} as ${created.roles.join(' and ')}`
          : `Added ${created.full_name} as ${created.roles.join(' and ')}`,
      subject: created,
      entity_type: 'user',
      entity_id: created.id,
    });

    const detail = await getUserDetail(c.env.DB, org, created.id);
    const body: ApiOk<UserDetail> = { data: detail! };
    return c.json(body, 201);
  })

  /** Returns the whole graph: roles, role profiles, availability, money, family. */
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');
    const org = c.get('org').id;

    // Checked before the read so an out-of-scope id is indistinguishable from
    // one that does not exist -- and so is somebody from another organization.
    const visible = await visibleUserIds(c.env.DB, org, viewer);
    if (visible && !visible.has(id)) throw ApiError.notFound('That user does not exist.');

    const detail = await getUserDetail(c.env.DB, org, id);

    if (!detail) throw ApiError.notFound('That user does not exist.');

    const body: ApiOk<UserDetail> = {
      // Each strips what this viewer may not see: the family's price, the
      // tutor's pay and advance, and the person's handles, SSN receipt and
      // family links beyond the reader's own view. The charge check reads the
      // guardians, so it runs before they are trimmed.
      data: scopePersonalDetails(
        scopeTutorTopup(scopeTutorPay(scopeStudentCharges(detail, viewer), viewer), viewer),
        viewer,
        visible,
      ),
    };
    return c.json(body);
  })

  /**
   * Records that the office has the tutor's SSN, or withdraws that.
   *
   * A deliberate one-field endpoint rather than part of the profile PATCH: it
   * is an action somebody takes on a particular day, it earns its own audit
   * line, and it cannot be reached with a body that carries a number -- the
   * schema has one boolean in it.
   */
  .post(
    '/:id/ssn-receipt',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('json', ssnReceiptSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { received } = c.req.valid('json');
      const viewer = c.get('user');
      const org = c.get('org');

      const existing = await getUserById(c.env.DB, org.id, id);
      if (!existing || existing.deleted_at) {
        throw ApiError.notFound('That user does not exist, or has been deactivated.');
      }

      if (!existing.roles.includes('tutor')) {
        throw ApiError.validation('Please correct the highlighted fields.', {
          roles: ['Only a tutor needs a tax document, so only a tutor can have this recorded.'],
        });
      }

      const receivedOn = await setSsnReceived(c.env.DB, org.id, id, received);

      await recordAudit(c.env.DB, viewer, org.id, {
        action: received ? 'tutor.ssn_confirmed' : 'tutor.ssn_cleared',
        // Says that the office HAS it, never what it is.
        description: received
          ? `Confirmed ${org.short_name} has ${existing.full_name}'s SSN on file`
          : `Withdrew the confirmation that ${existing.full_name}'s SSN is on file`,
        subject: { id: existing.id, full_name: existing.full_name },
        entity_type: 'user',
        entity_id: existing.id,
      });

      const body: ApiOk<{ ssn_received_on: string | null }> = {
        data: { ssn_received_on: receivedOn },
      };
      return c.json(body);
    },
  )

  .patch(
    '/:id',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('json', updateUserRequestSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { user: requested, sections } = splitUserRequest(c.req.valid('json'));
      const org = c.get('org').id;

      const existing = await getUserById(c.env.DB, org, id);
      if (!existing || existing.deleted_at) {
        throw ApiError.notFound('That user does not exist, or has been deactivated.');
      }

      // The form sends the whole record. A shared field it sends back
      // unchanged is no change, so only a real edit can trip the lock.
      const fields = { ...requested };
      for (const key of SHARED_FIELDS) {
        if (key in fields && fields[key] === existing[key]) delete fields[key];
      }
      const editsShared = SHARED_FIELDS.some((key) => key in fields);
      if (editsShared && (await belongsElsewhere(c.env.DB, org, id))) {
        throw new ApiError(409, 'shared_fields_locked', SHARED_FIELDS_LOCKED);
      }

      // Either side of this can change in one request, so both are resolved to
      // their post-update values before the invariant is checked.
      const finalRoles = fields.roles ?? existing.roles;
      const finalEmail = fields.email !== undefined ? fields.email : existing.email;
      const guardianCount = sections.guardians
        ? sections.guardians.length
        : await countGuardians(c.env.DB, org, id);

      assertStudentHasGuardian(finalRoles, guardianCount);
      assertEmailPresentIfNeeded(finalRoles, finalEmail);
      await assertGuardiansExist(c.env.DB, org, id, sections.guardians);

      try {
        if (Object.keys(fields).length > 0) {
          const updated = await updateUser(c.env.DB, org, id, fields);
          if (!updated) throw ApiError.notFound('That user does not exist.');
        }
      } catch (error) {
        if (isUniqueConstraintError(error)) throw ApiError.conflict(EMAIL_TAKEN);
        throw error;
      }

      await updateUserSections(c.env.DB, org, id, sections);

      const actor = c.get('user');

      // Role changes get their own event: they change what somebody can do, so
      // they should be findable without reading every "user.updated" line.
      const rolesChanged =
        fields.roles !== undefined &&
        [...fields.roles].sort().join(',') !== [...existing.roles].sort().join(',');

      if (rolesChanged) {
        await recordAudit(c.env.DB, actor, org, {
          action: 'user.roles_changed',
          description: `Changed ${existing.full_name}'s roles to ${fields.roles!.join(' and ')}`,
          subject: existing,
          entity_type: 'user',
          entity_id: id,
        });
      }

      const touched = { ...fields, ...sections };
      delete (touched as Record<string, unknown>).roles;

      const changedKeys = Object.fromEntries(
        Object.entries(touched).filter(([, value]) => value !== undefined),
      );

      if (Object.keys(changedKeys).length > 0) {
        await recordAudit(c.env.DB, actor, org, {
          action: 'user.updated',
          description: `Updated ${existing.full_name}'s ${describeChangedFields(changedKeys)}`,
          subject: existing,
          entity_type: 'user',
          entity_id: id,
        });
      }

      const detail = await getUserDetail(c.env.DB, org, id);
      const body: ApiOk<UserDetail> = { data: detail! };
      return c.json(body);
    },
  )

  /**
   * Soft-deletes by default so schedules and history keep resolving. Pass
   * `?hard=true` to remove the row and everything that cascades from it.
   */
  .delete(
    '/:id',
    requireAdmin,
    zValidator('param', idParamSchema),
    zValidator('query', deleteQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { hard } = c.req.valid('query');
      const org = c.get('org').id;

      if (c.get('user').id === id) {
        throw new ApiError(409, 'conflict', 'You cannot remove your own account.');
      }

      if (hard) {
        // Read the name first: after the delete there is nothing left to name,
        // and the log keeps a snapshot rather than a dangling id.
        const doomed = await getUserById(c.env.DB, org, id);

        // Erases what THIS organization holds about them; the person survives
        // in any other organization they belong to.
        if (!(await purgeUser(c.env.DB, org, id))) {
          throw ApiError.notFound('That user does not exist.');
        }

        await recordAudit(c.env.DB, c.get('user'), org, {
          action: 'user.deleted',
          description: `Permanently deleted ${doomed?.full_name ?? 'a user'}`,
          entity_type: 'user',
          entity_id: id,
        });

        return c.body(null, 204);
      }

      const user = await deactivateUser(c.env.DB, org, id);
      if (!user) {
        throw ApiError.notFound('That user does not exist, or was already deactivated.');
      }

      await recordAudit(c.env.DB, c.get('user'), org, {
        action: 'user.deactivated',
        description: `Deactivated ${user.full_name}`,
        subject: user,
        entity_type: 'user',
        entity_id: id,
      });

      const body: ApiOk<User> = { data: user };
      return c.json(body);
    },
  )

  .post('/:id/restore', requireAdmin, zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const org = c.get('org').id;

    try {
      const user = await restoreUser(c.env.DB, org, id);
      if (!user) {
        throw ApiError.notFound('That user does not exist, or is already active.');
      }

      await recordAudit(c.env.DB, c.get('user'), org, {
        action: 'user.restored',
        description: `Restored ${user.full_name}`,
        subject: user,
        entity_type: 'user',
        entity_id: id,
      });

      const body: ApiOk<User> = { data: user };
      return c.json(body);
    } catch (error) {
      // The unique email index only covers live rows, so restoring can collide
      // with someone created since.
      if (isUniqueConstraintError(error)) {
        throw ApiError.conflict(
          'Cannot restore: another active user now has that email address.',
        );
      }
      throw error;
    }
  });
