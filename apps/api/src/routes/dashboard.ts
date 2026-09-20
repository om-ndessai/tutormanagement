import { Hono } from 'hono';
import {
  dashboardQuerySchema,
  defaultDashboardRole,
  type ApiOk,
  type DashboardResponse,
} from '@tmi/shared';

import type { AppEnv } from '../types.js';
import { ApiError } from '../lib/errors.js';
import { isAdmin } from '../lib/scope.js';
import { zValidator } from '../lib/validate.js';
import { buildDashboard } from '../repositories/dashboard.js';
import { getLiveUserById } from '../repositories/users.js';

export const dashboardRoutes = new Hono<AppEnv>().get(
  '/',
  zValidator('query', dashboardQuerySchema),
  async (c) => {
    const viewer = c.get('user');
    const { role: requestedRole, user_id } = c.req.valid('query');

    // "Admin will have ability see the dashboard as seen by individual user."
    // Nobody else may name a subject.
    let subject = viewer;

    if (user_id && user_id !== viewer.id) {
      if (!isAdmin(viewer)) {
        throw new ApiError(403, 'forbidden', 'Only an administrator can view another dashboard.');
      }

      const other = await getLiveUserById(c.env.DB, user_id);
      if (!other) throw ApiError.notFound('That user does not exist.');

      subject = other;
    }

    // Asking for a role the subject does not hold would render a dashboard
    // about nothing, so it falls back rather than failing.
    const role =
      requestedRole && subject.roles.includes(requestedRole)
        ? requestedRole
        : defaultDashboardRole(subject.roles);

    if (!role) {
      throw new ApiError(
        409,
        'conflict',
        `${subject.full_name} has no roles, so there is no dashboard to show.`,
      );
    }

    const body: ApiOk<DashboardResponse> = {
      data: {
        subject: {
          user_id: subject.id,
          full_name: subject.full_name,
          roles: subject.roles,
          viewing_as_other: subject.id !== viewer.id,
        },
        role,
        data: await buildDashboard(c.env.DB, subject, role),
      },
    };

    return c.json(body);
  },
);
