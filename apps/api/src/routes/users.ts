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
import {
  isAdmin,
  scopeAdminTin,
  scopeStudentCharges,
  scopeTutorTopup,
  visibleUserIds,
} from '../lib/scope.js';
import { requireAdmin } from '../middleware/require-admin.js';
import {
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

const EMAIL_TAKEN = 'Another user already has that email address.';

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

  const missing = await findMissingUserIds(db, ids);

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
    const visible = await visibleUserIds(c.env.DB, c.get('user'));
    const { users, total } = await listUsers(c.env.DB, params, visible);

    const body: ApiList<User> = {
      data: users,
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

    assertStudentHasGuardian(fields.roles, sections.guardians?.length ?? 0);
    await assertGuardiansExist(c.env.DB, null, sections.guardians);

    let created: User;

    try {
      created = await createUser(c.env.DB, fields);
    } catch (error) {
      if (isUniqueConstraintError(error)) throw ApiError.conflict(EMAIL_TAKEN);
      throw error;
    }

    await updateUserSections(c.env.DB, created.id, sections);

    await recordAudit(c.env.DB, c.get('user'), {
      action: 'user.created',
      description: `Added ${created.full_name} as ${created.roles.join(' and ')}`,
      subject: created,
      entity_type: 'user',
      entity_id: created.id,
    });

    const detail = await getUserDetail(c.env.DB, created.id);
    const body: ApiOk<UserDetail> = { data: detail! };
    return c.json(body, 201);
  })

  /** Returns the whole graph: roles, role profiles, availability, money, family. */
  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const viewer = c.get('user');

    // Checked before the read so an out-of-scope id is indistinguishable from
    // one that does not exist.
    if (!isAdmin(viewer)) {
      const visible = await visibleUserIds(c.env.DB, viewer);
      if (visible && !visible.has(id)) throw ApiError.notFound('That user does not exist.');
    }

    const detail = await getUserDetail(c.env.DB, id);

    if (!detail) throw ApiError.notFound('That user does not exist.');

    const body: ApiOk<UserDetail> = {
      data: scopeAdminTin(scopeTutorTopup(scopeStudentCharges(detail, viewer), viewer), viewer),
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

      const existing = await getUserById(c.env.DB, id);
      if (!existing || existing.deleted_at) {
        throw ApiError.notFound('That user does not exist, or has been deactivated.');
      }

      if (!existing.roles.includes('tutor')) {
        throw ApiError.validation('Please correct the highlighted fields.', {
          roles: ['Only a tutor needs a tax document, so only a tutor can have this recorded.'],
        });
      }

      const receivedOn = await setSsnReceived(c.env.DB, id, received);

      await recordAudit(c.env.DB, viewer, {
        action: received ? 'tutor.ssn_confirmed' : 'tutor.ssn_cleared',
        // Says that the office HAS it, never what it is.
        description: received
          ? `Confirmed the institute has ${existing.full_name}'s SSN on file`
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
      const { user: fields, sections } = splitUserRequest(c.req.valid('json'));

      const existing = await getUserById(c.env.DB, id);
      if (!existing || existing.deleted_at) {
        throw ApiError.notFound('That user does not exist, or has been deactivated.');
      }

      // Either side of this can change in one request, so both are resolved to
      // their post-update values before the invariant is checked.
      const finalRoles = fields.roles ?? existing.roles;
      const finalEmail = fields.email !== undefined ? fields.email : existing.email;
      const guardianCount = sections.guardians
        ? sections.guardians.length
        : await countGuardians(c.env.DB, id);

      assertStudentHasGuardian(finalRoles, guardianCount);
      assertEmailPresentIfNeeded(finalRoles, finalEmail);
      await assertGuardiansExist(c.env.DB, id, sections.guardians);

      try {
        if (Object.keys(fields).length > 0) {
          const updated = await updateUser(c.env.DB, id, fields);
          if (!updated) throw ApiError.notFound('That user does not exist.');
        }
      } catch (error) {
        if (isUniqueConstraintError(error)) throw ApiError.conflict(EMAIL_TAKEN);
        throw error;
      }

      await updateUserSections(c.env.DB, id, sections);

      const actor = c.get('user');

      // Role changes get their own event: they change what somebody can do, so
      // they should be findable without reading every "user.updated" line.
      const rolesChanged =
        fields.roles !== undefined &&
        [...fields.roles].sort().join(',') !== [...existing.roles].sort().join(',');

      if (rolesChanged) {
        await recordAudit(c.env.DB, actor, {
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
        await recordAudit(c.env.DB, actor, {
          action: 'user.updated',
          description: `Updated ${existing.full_name}'s ${describeChangedFields(changedKeys)}`,
          subject: existing,
          entity_type: 'user',
          entity_id: id,
        });
      }

      const detail = await getUserDetail(c.env.DB, id);
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

      if (c.get('user').id === id) {
        throw new ApiError(409, 'conflict', 'You cannot remove your own account.');
      }

      if (hard) {
        // Read the name first: after the delete there is nothing left to name,
        // and the log keeps a snapshot rather than a dangling id.
        const doomed = await getUserById(c.env.DB, id);

        if (!(await purgeUser(c.env.DB, id))) {
          throw ApiError.notFound('That user does not exist.');
        }

        await recordAudit(c.env.DB, c.get('user'), {
          action: 'user.deleted',
          description: `Permanently deleted ${doomed?.full_name ?? 'a user'}`,
          entity_type: 'user',
          entity_id: id,
        });

        return c.body(null, 204);
      }

      const user = await deactivateUser(c.env.DB, id);
      if (!user) {
        throw ApiError.notFound('That user does not exist, or was already deactivated.');
      }

      await recordAudit(c.env.DB, c.get('user'), {
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

    try {
      const user = await restoreUser(c.env.DB, id);
      if (!user) {
        throw ApiError.notFound('That user does not exist, or is already active.');
      }

      await recordAudit(c.env.DB, c.get('user'), {
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
