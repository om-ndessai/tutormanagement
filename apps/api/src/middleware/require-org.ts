import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { LAST_ORG_COOKIE, ORG_HEADER, ORG_QUERY_PARAM } from '@tmi/shared';
import { ApiError } from '../lib/errors.js';
import { getMembership, getOrganizationBySlug, toOrgContext } from '../repositories/organizations.js';
import { getLiveUserById } from '../repositories/users.js';
import { isAuthEnabled, type AppEnv } from '../types.js';

/**
 * Which organization a request runs in, and the person's standing there.
 *
 * The organization is named on EVERY request -- the X-Organization header on
 * a fetch, `?org=` on a download or calendar link -- never remembered by the
 * server, so two tabs can sit in two organizations and a stale tab cannot act
 * in the wrong one. It is then checked against the person's membership on
 * every request, exactly as `requireAuth` re-reads the person: suspending or
 * removing someone takes effect on their next request.
 *
 * What it sets is what every handler reads:
 *   c.get('org')  - the organization, with a branded OrgId for repositories
 *   c.get('user') - the person AS A MEMBER: roles and status in this
 *                   organization only, which is what makes an admin of one
 *                   organization nobody special in another.
 *
 * A request naming no organization, an unknown or archived one, or one the
 * person is not an active member of, is refused the same way, so the answer
 * says nothing about which organizations exist.
 */
/**
 * The organization a request names: the header on a fetch, `?org=` on a link.
 *
 * With sign-in switched off (local development, the test deployment) the
 * remembered choice also counts, so a suite or a hand-typed URL need not name
 * the organization on every call. Never on a secured deployment.
 */
export function requestedOrgSlug(c: Context<AppEnv>): string {
  const remembered = isAuthEnabled(c.env) ? undefined : getCookie(c, LAST_ORG_COOKIE);
  return (c.req.header(ORG_HEADER) ?? c.req.query(ORG_QUERY_PARAM) ?? remembered ?? '')
    .trim()
    .toLowerCase();
}

export const requireOrg = createMiddleware<AppEnv>(async (c, next) => {
  const slug = requestedOrgSlug(c);
  const refuse = () =>
    new ApiError(403, 'organization_required', 'Choose an organization to continue.');

  if (!slug) throw refuse();

  const organization = await getOrganizationBySlug(c.env.DB, slug);
  if (!organization || organization.archived_at) throw refuse();

  const org = toOrgContext(organization);
  const person = c.get('person');
  const membership = await getMembership(c.env.DB, org.id, person.id);

  if (!membership || membership.removed || membership.status === 'invited') throw refuse();

  if (membership.status === 'suspended') {
    throw new ApiError(
      403,
      'account_suspended',
      `Your access to ${organization.name} has been suspended.`,
    );
  }

  const user = await getLiveUserById(c.env.DB, org.id, person.id);
  if (!user) throw refuse();

  c.set('org', org);
  c.set('user', user);
  return next();
});
