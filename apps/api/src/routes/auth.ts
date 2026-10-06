import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  LAST_ORG_COOKIE,
  PLATFORM_BRAND,
  brandFromOrganization,
  googleSignInSchema,
  type ApiOk,
  type AuthConfig,
  type SessionResponse,
} from '@tmi/shared';

import { recordAudit } from '../lib/audit.js';
import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import { orgIdFromRow } from '../lib/org.js';
import {
  SESSION_COOKIE,
  clearedSessionCookie,
  createSessionToken,
  readSessionToken,
  sessionCookie,
} from '../lib/session.js';
import { zValidator } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requestedOrgSlug } from '../middleware/require-org.js';
import { isAdmin } from '../lib/scope.js';
import { getOnboarding } from '../repositories/onboarding.js';
import {
  answerInvitation,
  getMembership,
  getOrganizationBySlug,
  getOrganizationSettings,
  getPublicBrand,
  listInvitations,
  listMemberships,
  recordEntry,
} from '../repositories/organizations.js';
import {
  addPlatformAdmin,
  countPlatformAdmins,
  createPerson,
  getPersonById,
  isPlatformAdmin,
  recordSignIn,
  resolveSignIn,
  type Person,
} from '../repositories/people.js';
import { getLiveUserById } from '../repositories/users.js';
import { isAuthEnabled, isProduction, type AppEnv, type Env } from '../types.js';

/** Parses the comma-separated BOOTSTRAP_ADMIN_EMAILS var. */
function bootstrapEmails(env: Env): string[] {
  return (env.BOOTSTRAP_ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Everything the SPA needs to know about the signed-in person: who they are
 * in the organization the request named (if they may enter it), every
 * organization they may enter, the invitations waiting for them, and whether
 * they may use the platform console.
 */
async function sessionPayload(
  env: Env,
  person: Person,
  platformAdmin: boolean,
  impersonated: boolean,
  slug: string | undefined,
): Promise<SessionResponse> {
  const [memberships, invitations] = await Promise.all([
    listMemberships(env.DB, person.id),
    listInvitations(env.DB, person.id),
  ]);

  let organization: SessionResponse['organization'] = null;
  // Who they are in the named organization: roles and status there. Outside
  // one (choosing, or on the console) they are the person and nothing more.
  let user: SessionResponse['user'] = {
    id: person.id,
    email: person.email,
    full_name: person.full_name,
    phone: person.phone,
    status: 'active',
    roles: [],
    created_at: person.created_at,
    updated_at: person.updated_at,
    last_login_at: person.last_login_at,
    deleted_at: null,
  };

  const chosen = slug ? memberships.find((m) => m.slug === slug && m.status === 'active') : undefined;
  if (chosen) {
    const org = await getOrganizationBySlug(env.DB, chosen.slug);
    const orgId = org ? orgIdFromRow(org.id) : null;
    const member = orgId ? await getLiveUserById(env.DB, orgId, person.id) : null;
    if (org && orgId && member) {
      user = member;
      organization = {
        ...org,
        // The payer details are the office's: its admins only.
        settings: isAdmin(member) ? await getOrganizationSettings(env.DB, orgId) : null,
      };
    }
  }

  return {
    user,
    impersonated,
    onboarding: await getOnboarding(
      env.DB,
      organization ? orgIdFromRow(organization.id) : null,
      person.id,
    ),
    organization,
    memberships,
    invitations,
    platform_admin: platformAdmin,
  };
}

export const authRoutes = new Hono<AppEnv>()

  /**
   * Public. The SPA calls this before rendering anything: which Google client
   * to use, whether there is a sign-in screen at all, and what the sign-in
   * page should look like -- the organization this browser last chose, or the
   * neutral platform brand.
   */
  .get('/config', async (c) => {
    const enabled = isAuthEnabled(c.env);
    // The organization this browser last chose, else the one this address is for.
    const remembered = (getCookie(c, LAST_ORG_COOKIE) || c.env.DEFAULT_ORGANIZATION || '')
      .trim()
      .toLowerCase();
    const brandOrg = remembered ? await getPublicBrand(c.env.DB, remembered) : null;

    const body: ApiOk<AuthConfig> = {
      data: {
        google_client_id: enabled ? c.env.GOOGLE_CLIENT_ID : null,
        auth_enabled: enabled,
        brand: brandOrg ? brandFromOrganization(brandOrg) : PLATFORM_BRAND,
      },
    };
    return c.json(body);
  })

  /**
   * Public. Exchanges a Google ID token for a session cookie.
   *
   * The token is the only thing the browser supplies, and it is verified
   * against Google's public keys before any of its claims are believed.
   */
  .post('/google', zValidator('json', googleSignInSchema), async (c) => {
    if (!isAuthEnabled(c.env)) {
      throw ApiError.badRequest('Authentication is disabled on this deployment.');
    }

    const { credential } = c.req.valid('json');
    const identity = await verifyGoogleIdToken(credential, c.env.GOOGLE_CLIENT_ID);

    const { person: found, pinnedToAnother } = await resolveSignIn(c.env.DB, identity);

    if (pinnedToAnother) {
      // The address belongs to someone whose account is pinned to a different
      // Google login. Refused: otherwise whoever could change an email in one
      // organization could sign in as that person in all of them.
      await recordAudit(c.env.DB, null, 'platform', {
        action: 'auth.denied',
        description: `Sign-in refused for ${identity.email}: a different Google account is linked`,
      });
      throw new ApiError(
        403,
        'no_account',
        'That address is linked to a different Google account. Ask the platform administrator.',
      );
    }

    let person = found;
    let platformAdmin = person ? await isPlatformAdmin(c.env.DB, person.id) : false;

    // The escape hatch on a fresh platform: while there is no platform admin,
    // an address in BOOTSTRAP_ADMIN_EMAILS becomes one.
    if (!platformAdmin && bootstrapEmails(c.env).includes(identity.email)) {
      if ((await countPlatformAdmins(c.env.DB)) === 0) {
        person ??= await createPerson(c.env.DB, {
          email: identity.email,
          full_name: identity.name?.trim() || identity.email,
        });
        await addPlatformAdmin(c.env.DB, person.id);
        platformAdmin = true;
      }
    }

    if (!person) {
      await recordAudit(c.env.DB, null, 'platform', {
        action: 'auth.denied',
        description: `Sign-in refused for ${identity.email}: no portal account`,
      });
      throw new ApiError(
        403,
        'no_account',
        'You are not authorized to access this portal. Please reach out to the administrator.',
      );
    }

    try {
      await recordSignIn(c.env.DB, person.id, identity.sub);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ApiError(409, 'conflict', 'That Google account is already linked to another user.');
      }
      throw error;
    }

    const [memberships, invitations] = await Promise.all([
      listMemberships(c.env.DB, person.id),
      listInvitations(c.env.DB, person.id),
    ]);

    // Somebody with nowhere to go and nothing to answer has no business here.
    if (!platformAdmin && memberships.length === 0 && invitations.length === 0) {
      await recordAudit(c.env.DB, null, 'platform', {
        action: 'auth.denied',
        description: `Sign-in refused for ${identity.email}: no organization`,
      });
      throw new ApiError(
        403,
        'no_account',
        'You are not authorized to access this portal. Please reach out to the administrator.',
      );
    }

    // The sign-in itself belongs to no organization: entering one is logged
    // there (POST /enter), so one organization never learns when a person
    // used another.
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'auth.signed_in',
      description: `${person.full_name} signed in with Google`,
      entity_type: 'user',
      entity_id: person.id,
    });

    const token = await createSessionToken(person.id, c.env.SESSION_SECRET);
    c.header('Set-Cookie', sessionCookie(token, isProduction(c.env)));

    const refreshed = (await getPersonById(c.env.DB, person.id)) ?? person;
    const body: ApiOk<SessionResponse> = {
      data: await sessionPayload(c.env, refreshed, platformAdmin, false, undefined),
    };
    return c.json(body);
  })

  /**
   * Who am I -- and, when the request names an organization, who am I there?
   * The SPA calls this on load to restore an existing session.
   */
  .get('/session', requireAuth, async (c) => {
    const slug = requestedOrgSlug(c) || undefined;
    const body: ApiOk<SessionResponse> = {
      data: await sessionPayload(
        c.env,
        c.get('person'),
        c.get('platformAdmin'),
        c.get('impersonated'),
        slug,
      ),
    };
    return c.json(body);
  })

  /**
   * Notes that the person opened the organization this tab names, and logs it
   * there -- once per sign-in, not on every reload.
   */
  .post('/enter', requireAuth, async (c) => {
    const slug = requestedOrgSlug(c);
    const person = c.get('person');
    const org = slug ? await getOrganizationBySlug(c.env.DB, slug) : null;
    const orgId = org && !org.archived_at ? orgIdFromRow(org.id) : null;
    const membership = orgId ? await getMembership(c.env.DB, orgId, person.id) : null;

    if (!org || !orgId || !membership || membership.removed || membership.status !== 'active') {
      throw new ApiError(403, 'organization_required', 'Choose an organization to continue.');
    }

    const token = getCookie(c, SESSION_COOKIE);
    const issuedAt = token ? await sessionIssuedAt(token, c.env.SESSION_SECRET) : null;
    const entry = await recordEntry(c.env.DB, orgId, person.id, issuedAt);

    if (entry.firstSinceSignIn) {
      await recordAudit(c.env.DB, person, orgId, {
        action: 'auth.entered',
        description: `${person.full_name} opened ${org.name}`,
        entity_type: 'user',
        entity_id: person.id,
      });
    }

    const body: ApiOk<{ first_visit: boolean }> = { data: { first_visit: entry.firstEver } };
    return c.json(body);
  })

  /** Accepts or declines an invitation to an organization. */
  .post('/invitations/:slug/:answer', requireAuth, async (c) => {
    const answer = c.req.param('answer');
    if (answer !== 'accept' && answer !== 'decline') throw ApiError.notFound('Invitation not found.');

    const person = c.get('person');
    const org = await getOrganizationBySlug(c.env.DB, c.req.param('slug'));
    const orgId = org && !org.archived_at ? orgIdFromRow(org.id) : null;
    const answered = orgId
      ? await answerInvitation(c.env.DB, orgId, person.id, answer === 'accept')
      : false;
    if (!org || !orgId || !answered) throw ApiError.notFound('Invitation not found.');

    await recordAudit(c.env.DB, person, orgId, {
      action: answer === 'accept' ? 'membership.accepted' : 'membership.declined',
      description:
        answer === 'accept'
          ? `${person.full_name} accepted the invitation to ${org.name}`
          : `${person.full_name} declined the invitation to ${org.name}`,
      subject: { id: person.id, full_name: person.full_name },
      entity_type: 'user',
      entity_id: person.id,
    });

    const body: ApiOk<SessionResponse> = {
      data: await sessionPayload(
        c.env,
        person,
        c.get('platformAdmin'),
        c.get('impersonated'),
        undefined,
      ),
    };
    return c.json(body);
  })

  .post('/logout', async (c) => {
    // The cookie is cleared regardless; the log entry is best-effort and only
    // possible when we can still tell who was signed in.
    const token = getCookie(c, SESSION_COOKIE);

    if (token) {
      try {
        const { sub } = await readSessionToken(token, c.env.SESSION_SECRET);
        const person = await getPersonById(c.env.DB, sub);
        if (person) {
          await recordAudit(c.env.DB, person, 'platform', {
            action: 'auth.signed_out',
            description: `${person.full_name} signed out`,
            entity_type: 'user',
            entity_id: person.id,
          });
        }
      } catch {
        // An expired or forged cookie simply produces no log entry.
      }
    }

    c.header('Set-Cookie', clearedSessionCookie(isProduction(c.env)));
    return c.body(null, 204);
  });

/** When the session cookie was minted, as ISO, so entries are logged once per sign-in. */
async function sessionIssuedAt(token: string, secret: string): Promise<string | null> {
  try {
    const { iat } = await readSessionToken(token, secret);
    return iat ? new Date(iat * 1000).toISOString() : null;
  } catch {
    return null;
  }
}
