import { Hono } from 'hono';
import { z } from 'zod';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  type ApiList,
  type ApiOk,
  type User,
} from '@tmi/shared';
import type { AppEnv } from '../types.js';
import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { zValidator } from '../lib/validate.js';
import {
  createUser,
  deactivateUser,
  getUserById,
  listUsers,
  purgeUser,
  restoreUser,
  updateUser,
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

export const usersRoutes = new Hono<AppEnv>()

  .get('/', zValidator('query', listUsersQuerySchema), async (c) => {
    const params = c.req.valid('query');
    const { users, total } = await listUsers(c.env.DB, params);

    const body: ApiList<User> = {
      data: users,
      meta: { total, limit: params.limit, offset: params.offset },
    };
    return c.json(body);
  })

  .post('/', zValidator('json', createUserSchema), async (c) => {
    const input = c.req.valid('json');

    try {
      const user = await createUser(c.env.DB, input);
      const body: ApiOk<User> = { data: user };
      return c.json(body, 201);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw ApiError.conflict(EMAIL_TAKEN);
      }
      throw error;
    }
  })

  .get('/:id', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');
    const user = await getUserById(c.env.DB, id);

    if (!user) {
      throw ApiError.notFound('That user does not exist.');
    }

    const body: ApiOk<User> = { data: user };
    return c.json(body);
  })

  .patch(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('json', updateUserSchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      try {
        const user = await updateUser(c.env.DB, id, input);

        if (!user) {
          throw ApiError.notFound('That user does not exist, or has been deactivated.');
        }

        const body: ApiOk<User> = { data: user };
        return c.json(body);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw ApiError.conflict(EMAIL_TAKEN);
        }
        throw error;
      }
    },
  )

  /**
   * Soft-deletes by default so schedules and history keep resolving. Pass
   * `?hard=true` to remove the row permanently.
   */
  .delete(
    '/:id',
    zValidator('param', idParamSchema),
    zValidator('query', deleteQuerySchema),
    async (c) => {
      const { id } = c.req.valid('param');
      const { hard } = c.req.valid('query');

      if (hard) {
        const removed = await purgeUser(c.env.DB, id);

        if (!removed) {
          throw ApiError.notFound('That user does not exist.');
        }

        return c.body(null, 204);
      }

      const user = await deactivateUser(c.env.DB, id);

      if (!user) {
        throw ApiError.notFound('That user does not exist, or was already deactivated.');
      }

      const body: ApiOk<User> = { data: user };
      return c.json(body);
    },
  )

  .post('/:id/restore', zValidator('param', idParamSchema), async (c) => {
    const { id } = c.req.valid('param');

    try {
      const user = await restoreUser(c.env.DB, id);

      if (!user) {
        throw ApiError.notFound('That user does not exist, or is already active.');
      }

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
