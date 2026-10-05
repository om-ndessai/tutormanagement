import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { ApiError } from '../lib/errors.js';
import { SESSION_COOKIE, readSessionToken } from '../lib/session.js';
import {
  addPlatformAdmin,
  createPerson,
  getFirstPerson,
  getPersonByEmail,
  getPersonById,
  isPlatformAdmin,
  type Person,
} from '../repositories/people.js';
import { getFirstAdminMembership } from '../repositories/users.js';
import {
  createOrganization,
  ensureMembershipWithRoles,
  getFirstOrganization,
} from '../repositories/organizations.js';
import { isAuthEnabled, type AppEnv } from '../types.js';

/**
 * Who is asking: the PERSON, across every organization.
 *
 * The session cookie carries only a user id, so the row is re-read here on
 * every request -- erasing an account takes effect at once. What they may do
 * in an organization is decided after this, by `requireOrg`, which re-reads
 * their membership and roles there the same way.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!isAuthEnabled(c.env)) {
    // Lets the end-to-end suite act as each kind of person without
    // redeploying. Only read while auth is off -- a deployment in that state
    // is already fully open, so this grants nothing that was not available.
    const requested = c.req.header(DEV_USER_HEADER)?.trim();
    const person = await resolveBypassPerson(c.env, requested);
    c.set('person', person);
    c.set('platformAdmin', await isPlatformAdmin(c.env.DB, person.id));
    c.set('impersonated', true);
    return next();
  }

  const token = getCookie(c, SESSION_COOKIE);

  if (!token) {
    throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  }

  const { sub } = await readSessionToken(token, c.env.SESSION_SECRET);
  const person = await getPersonById(c.env.DB, sub);

  if (!person) {
    throw new ApiError(401, 'unauthenticated', 'Your account is no longer active.');
  }

  c.set('person', person);
  c.set('platformAdmin', await isPlatformAdmin(c.env.DB, person.id));
  c.set('impersonated', false);
  return next();
});

/**
 * Names the person to act as while AUTH_ENABLED is "false". Honoured only in
 * that state; ignored entirely on a deployment with sign-in switched on.
 */
export const DEV_USER_HEADER = 'X-Dev-User';

/** Placeholder identity created when the directory is empty. */
const FALLBACK_DEV_EMAIL = 'portal-admin@example.com';

/**
 * The person used while AUTH_ENABLED is "false", so the portal can be built
 * and tested without signing in.
 *
 * Resolution order: the X-Dev-User header, DEV_USER_EMAIL, the first admin of
 * any organization, anyone at all, and finally a placeholder created on the
 * spot -- together with a "Local" organization they administer, so a freshly
 * rebuilt database is never a dead portal.
 *
 * Only reachable while AUTH_ENABLED is "false", so it cannot create anything
 * on a secured deployment.
 */
async function resolveBypassPerson(env: AppEnv['Bindings'], requestedEmail?: string): Promise<Person> {
  if (requestedEmail) {
    const requested = await getPersonByEmail(env.DB, requestedEmail);

    if (!requested) {
      throw new ApiError(
        404,
        'not_found',
        `No live user matches the requested ${DEV_USER_HEADER} address (${requestedEmail}).`,
      );
    }

    return requested;
  }

  const configured = env.DEV_USER_EMAIL?.trim();

  if (configured) {
    const named = await getPersonByEmail(env.DB, configured);
    if (named) return named;
  }

  const admin = await getFirstAdminMembership(env.DB);
  if (admin) {
    const person = await getPersonById(env.DB, admin.user_id);
    if (person) return person;
  }

  const anyone = await getFirstPerson(env.DB);
  if (anyone) return anyone;

  console.warn('AUTH_ENABLED=false and the database is empty; creating a placeholder admin.');

  const person = await createPerson(env.DB, {
    email: configured || FALLBACK_DEV_EMAIL,
    full_name: 'Portal Admin (auth disabled)',
  });
  const org =
    (await getFirstOrganization(env.DB)) ??
    (await createOrganization(
      env.DB,
      {
        name: 'Local Organization',
        short_name: 'Local',
        slug: 'local',
        tagline: null,
        blurb: null,
        place: null,
        palette: 'platform',
        builtin_logo: null,
        time_zone: 'America/New_York',
      },
      'local.invalid',
    ));
  await ensureMembershipWithRoles(env.DB, org.id, person.id, ['admin']);
  await env.DB
    .prepare("UPDATE org_members SET status = 'active' WHERE organization_id = ? AND user_id = ?")
    .bind(org.id, person.id)
    .run();
  await addPlatformAdmin(env.DB, person.id);
  return person;
}
