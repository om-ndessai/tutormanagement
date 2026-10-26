import { Hono, type Context } from 'hono';
import { getCookie } from 'hono/cookie';
import {
  PLATFORM_BRAND,
  brandFromOrganization,
  googleSignInSchema,
  type ApiOk,
  type AuthConfig,
  type SessionResponse,
  defaultOrganizationSchema,
  PRIVACY_VERSION,
  TERMS_VERSION,
  ageBandFor,
  signupSchema,
  type SignupStart,
  AUTH_PROVIDER_LABELS,
  AUTH_PROVIDERS,
  providerSignInSchema,
  type AuthProvider,
  type UserIdentity,
} from '@tmi/shared';

import { recordAudit } from '../lib/audit.js';
import { ApiError, isUniqueConstraintError } from '../lib/errors.js';
import { verifyGoogleIdToken } from '../lib/google.js';
import {
  assertOffered,
  fakeProvidersOn,
  offeredProviders,
  providerInfo,
  verifyFakeToken,
  type VerifiedIdentity,
} from '../lib/identity.js';
import { microsoftAuthorizeUrl, verifyMicrosoftIdToken } from '../lib/microsoft.js';
import {
  appleAudiences,
  appleAuthorizeUrl,
  appleNameFromForm,
  exchangeAppleCode,
  revokeAppleToken,
  verifyAppleIdToken,
  verifyAppleNotification,
} from '../lib/apple.js';
import {
  exchangeFacebookCode,
  facebookAuthorizeUrl,
  verifyFacebookAccessToken,
  verifyFacebookLimitedToken,
} from '../lib/facebook.js';
import { OAUTH_COOKIE, clearedStateCookie, randomToken, readState, safeReturnTo, stateCookie } from '../lib/oauth-state.js';
import { seal, unseal } from '../lib/seal.js';
import { allowlistOn, assertInvited } from '../lib/invited.js';
import { createSignupToken, readSignupToken } from '../lib/signup-token.js';
import { orgIdFromRow } from '../lib/org.js';
import { clientAddress, rateLimit } from '../lib/rate-limit.js';
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
  listMyJoinRequests,
  setDefaultOrganization,
  recordEntry,
} from '../repositories/organizations.js';
import {
  accountDeletable,
  addPlatformAdmin,
  countPlatformAdmins,
  createSignedUpPerson,
  deleteOwnAccount,
  getPersonByEmail,
  getPlatformAccount,
  createPerson,
  getPersonById,
  isPlatformAdmin,
  recordSignIn,
  resolveIdentity,
  identityStatements,
  listIdentities,
  removeIdentity,
  appleRevokeTokens,
  forgetIdentity,
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
  const [memberships, invitations, account, joinRequests] = await Promise.all([
    listMemberships(env.DB, person.id),
    listInvitations(env.DB, person.id),
    getPlatformAccount(env.DB, person.id),
    listMyJoinRequests(env.DB, person.id),
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
    account,
    join_requests: joinRequests,
  };
}

// ---------------------------------------------------------------------------
// Phase 55: every provider signs in the same way (docs/social-login-plan.md)
// ---------------------------------------------------------------------------

type AuthContext = Context<AppEnv>;

/** The provider a path names (`/api/auth/<provider>/...`); the routes list exactly the three. */
function providerIn(path: string): AuthProvider {
  const match = /\/auth\/(microsoft|apple|facebook)(?:\/|$)/.exec(path);
  if (!match) throw ApiError.notFound('Not found.');
  return match[1] as AuthProvider;
}

/** A provider named by a client: one of the four, else 404 as for a route that is not there. */
function knownProvider(value: string): AuthProvider {
  if (!(AUTH_PROVIDERS as readonly string[]).includes(value)) throw ApiError.notFound('Not found.');
  return value as AuthProvider;
}

/** Sign-in is a route only while it is on -- or, locally, while the suite's fake providers are. */
function assertSignInAvailable(env: Env): void {
  if (!isAuthEnabled(env) && !fakeProvidersOn(env)) {
    throw ApiError.badRequest('Authentication is disabled on this deployment.');
  }
}

/** Google's verifier keeps its own shape (and its 403 for an unverified address). */
function toVerified(identity: { sub: string; email: string; name?: string }): VerifiedIdentity {
  return { provider: 'google', subject: identity.sub, email: identity.email, emailVerified: true, name: identity.name?.trim() || null };
}

/** A provider token from a client, through that provider's own verifier (or the suite's fake). */
async function verifyProviderInput(
  env: Env,
  provider: AuthProvider,
  input: { id_token?: string; access_token?: string; name?: string },
): Promise<VerifiedIdentity> {
  const fake = verifyFakeToken(env, provider, input.id_token ?? input.access_token ?? '');
  // Apple's name comes from the client the first time, for the fake as for the real thing.
  if (fake) return provider === 'apple' && !fake.name && input.name ? { ...fake, name: input.name.trim() } : fake;
  switch (provider) {
    case 'microsoft':
      if (!input.id_token) throw ApiError.badRequest('Missing the Microsoft sign-in token.');
      return verifyMicrosoftIdToken(input.id_token, env.MICROSOFT_CLIENT_ID!);
    case 'apple':
      if (!input.id_token) throw ApiError.badRequest('Missing the Apple sign-in token.');
      return verifyAppleIdToken(input.id_token, appleAudiences(env), { name: input.name ?? null });
    case 'facebook':
      if (input.access_token) {
        return verifyFacebookAccessToken(input.access_token, env.FACEBOOK_APP_ID!, env.FACEBOOK_APP_SECRET!);
      }
      return verifyFacebookLimitedToken(input.id_token ?? '', env.FACEBOOK_APP_ID!);
    default:
      throw ApiError.badRequest('Unknown way to sign in.');
  }
}

/** The audience the app's native Apple button signs for: its bundle id. */
function appleNativeAudience(env: Env): string {
  return (env.APPLE_BUNDLE_IDS ?? '').split(',')[0]?.trim() || env.APPLE_SERVICES_ID || '';
}

/** Apple's refresh token for this sign-in, sealed, so it can be revoked on deletion. Null without the paid key. */
async function keepAppleToken(env: Env, code: string, clientId: string, redirectUri?: string): Promise<string | null> {
  const refresh = await exchangeAppleCode(env, code, clientId, redirectUri);
  return refresh ? seal(refresh, env.SESSION_SECRET) : null;
}

async function revokeKeptAppleToken(env: Env, sealed: string): Promise<void> {
  const refresh = await unseal(sealed, env.SESSION_SECRET);
  if (!refresh) return;
  for (const clientId of appleAudiences(env)) {
    if (await revokeAppleToken(env, refresh, clientId)) return;
  }
}

/** This Worker's own callback address for a provider: where the provider sends the browser back. */
function callbackUri(requestUrl: string, provider: AuthProvider): string {
  return `${new URL(requestUrl).origin}/api/auth/${provider}/callback`;
}

/** A path on this site with values in its fragment, which never reaches a server or a log. */
function withHash(path: string, values: Record<string, string>): string {
  return `${safeReturnTo(path)}#${new URLSearchParams(values).toString()}`;
}

/**
 * What a verified provider account does here: signs a person in (a session
 * cookie and the session), starts a newcomer's sign-up (Phase 52), or is
 * refused in words the sign-in page shows. The same for every provider.
 */
async function completeSignIn(
  c: AuthContext,
  identity: VerifiedIdentity,
  options: { asked: boolean; revokeToken?: string | null },
): Promise<ApiOk<SessionResponse | SignupStart>> {
  const env = c.env;
  const label = AUTH_PROVIDER_LABELS[identity.provider];
  // Phase 52: sign-up is offered only to a client that can show it, and only while it is open.
  const canSignUp = options.asked && env.SIGNUP_OPEN !== 'false';
  // Phase 53: the test portal admits only invited people -- checked before the person is looked
  // up, before sign-up, and before any log line names them.
  if (allowlistOn(env)) {
    await assertInvited(env, { email: identity.email, provider: identity.provider, subject: identity.subject });
  }

  const { person: found, refusal } = await resolveIdentity(env.DB, identity);
  if (refusal) {
    await recordAudit(env.DB, null, 'platform', {
      action: 'auth.denied',
      description:
        refusal === 'pinned'
          ? `Sign-in refused for ${identity.email}: a different ${label} account is linked`
          : `Sign-in refused for ${identity.email}: ${label} does not vouch for the address`,
    });
    throw new ApiError(
      403,
      'no_account',
      refusal === 'pinned'
        ? `That address is linked to a different ${label} account. Ask the platform administrator.`
        : `Sign in the way you did before, then add ${label} on My profile.`,
    );
  }

  let person = found;
  let platformAdmin = person ? await isPlatformAdmin(env.DB, person.id) : false;

  // The escape hatch on a fresh platform: while there is no platform admin,
  // an address in BOOTSTRAP_ADMIN_EMAILS becomes one.
  if (!platformAdmin && identity.email && identity.emailVerified && bootstrapEmails(env).includes(identity.email)) {
    if ((await countPlatformAdmins(env.DB)) === 0) {
      person ??= await createPerson(env.DB, {
        email: identity.email,
        full_name: identity.name?.trim() || identity.email,
      });
      await addPlatformAdmin(env.DB, person.id);
      platformAdmin = true;
    }
  }

  if (!person && canSignUp) {
    // Everyone but a student needs an address, and a newcomer's is how they are found again.
    if (!identity.email || !identity.emailVerified) {
      throw new ApiError(
        403,
        'email_unverified',
        `Your ${label} account shares no verified email address. Sign up another way.`,
      );
    }
    // Phase 52: a newcomer. Nothing is written and nothing logged until they answer the age
    // question; the token carries who the provider says they are, for 15 minutes.
    const name = identity.name?.trim() || identity.email;
    return {
      data: {
        signup: {
          token: await createSignupToken(
            { sub: identity.subject, email: identity.email, name, provider: identity.provider },
            env.SESSION_SECRET,
          ),
          email: identity.email,
          name,
        },
      },
    };
  }

  if (!person) {
    await recordAudit(env.DB, null, 'platform', {
      action: 'auth.denied',
      description: `Sign-in refused for ${identity.email ?? `a ${label} account with no address`}: no portal account`,
    });
    throw new ApiError(403, 'no_account', 'You are not authorized to access this portal. Please reach out to the administrator.');
  }

  try {
    await recordSignIn(env.DB, person.id, identity, options.revokeToken ?? null);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ApiError(409, 'conflict', `That ${label} account is already linked to another user.`);
    }
    throw error;
  }

  const [memberships, invitations] = await Promise.all([
    listMemberships(env.DB, person.id),
    listInvitations(env.DB, person.id),
  ]);

  // Somebody with nowhere to go and nothing to answer has no business here -- unless this client
  // can show them the Welcome page (Phase 52: join a space with its code, or make one).
  if (!platformAdmin && memberships.length === 0 && invitations.length === 0 && !canSignUp) {
    await recordAudit(env.DB, null, 'platform', {
      action: 'auth.denied',
      description: `Sign-in refused for ${identity.email}: no organization`,
    });
    throw new ApiError(403, 'no_account', 'You are not authorized to access this portal. Please reach out to the administrator.');
  }

  // The sign-in itself belongs to no organization: entering one is logged
  // there (POST /enter), so one organization never learns when a person
  // used another.
  await recordAudit(env.DB, person, 'platform', {
    action: 'auth.signed_in',
    description: `${person.full_name} signed in with ${label}`,
    entity_type: 'user',
    entity_id: person.id,
  });

  const token = await createSessionToken(person.id, env.SESSION_SECRET);
  c.header('Set-Cookie', sessionCookie(token, isProduction(env)), { append: true });

  const refreshed = (await getPersonById(env.DB, person.id)) ?? person;
  return { data: await sessionPayload(env, refreshed, platformAdmin, false, undefined) };
}

/**
 * Adds a provider account to a person's ways in. Refused when that account
 * already signs somebody (else) in, or the person already has one from that
 * provider. Logged on the platform log, never with the provider's id.
 */
async function linkIdentity(env: Env, userId: string, identity: VerifiedIdentity, revokeToken: string | null): Promise<void> {
  const label = AUTH_PROVIDER_LABELS[identity.provider];
  const person = await getPersonById(env.DB, userId);
  if (!person) throw new ApiError(401, 'unauthenticated', 'Your account is no longer active.');
  if (allowlistOn(env)) {
    await assertInvited(env, { email: identity.email, provider: identity.provider, subject: identity.subject });
  }
  const { person: owner } = await resolveIdentity(env.DB, { ...identity, email: null });
  if (owner && owner.id !== userId) {
    throw ApiError.conflict(`That ${label} account already signs in someone else.`);
  }
  if (owner?.id === userId) return;
  if ((await listIdentities(env.DB, userId)).some((row) => row.provider === identity.provider)) {
    throw ApiError.conflict(`You already sign in with a ${label} account. Remove it first.`);
  }
  try {
    await env.DB.batch(identityStatements(env.DB, userId, identity, revokeToken));
  } catch (error) {
    if (isUniqueConstraintError(error)) throw ApiError.conflict(`That ${label} account is already linked.`);
    throw error;
  }
  await recordAudit(env.DB, person, 'platform', {
    action: 'identity.linked',
    description: `${person.full_name} added ${label} to their ways to sign in`,
    entity_type: 'user',
    entity_id: person.id,
  });
}

export const authRoutes = new Hono<AppEnv>()

  /**
   * Public. The SPA calls this before rendering anything: which Google client
   * to use, whether there is a sign-in screen at all, and what the sign-in
   * page should look like.
   *
   * Only the organization this ADDRESS is for (DEFAULT_ORGANIZATION) may brand
   * it -- the institute's address wears the institute -- and a shared address
   * like `tutoring` wears the neutral platform brand. Never the browser's last
   * organization: that put one organization's logo and colours on the shared
   * sign-in page for everybody who had once been in it. An organization's own
   * look appears once someone signs in and enters it.
   */
  .get('/config', async (c) => {
    const enabled = isAuthEnabled(c.env);
    const own = (c.env.DEFAULT_ORGANIZATION || '').trim().toLowerCase();
    const brandOrg = own ? await getPublicBrand(c.env.DB, own) : null;

    const body: ApiOk<AuthConfig> = {
      data: {
        google_client_id: enabled ? c.env.GOOGLE_CLIENT_ID : null,
        auth_enabled: enabled,
        signup_open: c.env.SIGNUP_OPEN !== 'false',
        // Phase 55: Google first, then whichever others this Worker lists and has set up.
        providers: enabled ? providerInfo(c.env) : [],
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
   * Phase 55: the same completion as every other provider (`completeSignIn`).
   */
  .post('/google', zValidator('json', googleSignInSchema), async (c) => {
    assertSignInAvailable(c.env);
    await rateLimit(c, 'sign_in', clientAddress(c));
    const { credential, signup: asked } = c.req.valid('json');
    const identity =
      verifyFakeToken(c.env, 'google', credential) ?? toVerified(await verifyGoogleIdToken(credential, c.env.GOOGLE_CLIENT_ID));
    return c.json(await completeSignIn(c, identity, { asked: Boolean(asked) }));
  })

  /**
   * Phase 55: Microsoft, Apple and Facebook, from a client that holds the
   * provider's token itself (the app's native flows, and the suite's fake). The
   * web's own buttons use the redirect flows below.
   */
  .on('POST', ['/microsoft', '/apple', '/facebook'], zValidator('json', providerSignInSchema), async (c) => {
    const provider = providerIn(c.req.path);
    assertSignInAvailable(c.env);
    assertOffered(c.env, provider);
    await rateLimit(c, 'sign_in', clientAddress(c));
    const input = c.req.valid('json');
    const identity = await verifyProviderInput(c.env, provider, input);
    const revokeToken =
      provider === 'apple' && input.authorization_code
        ? await keepAppleToken(c.env, input.authorization_code, appleNativeAudience(c.env))
        : null;
    return c.json(await completeSignIn(c, identity, { asked: Boolean(input.signup), revokeToken }));
  })

  /**
   * Phase 55, the web: off to the provider. `?signup=1` when the page can sign
   * a newcomer up; `?link=1` (signed in) to add this provider to the person's
   * ways in; `?return=/path` where to land after.
   */
  .on('GET', ['/microsoft/start', '/apple/start', '/facebook/start'], async (c) => {
    const provider = providerIn(c.req.path);
    assertSignInAvailable(c.env);
    assertOffered(c.env, provider);
    const linking = c.req.query('link') === '1';
    let linkUserId: string | null = null;
    if (linking) {
      const token = getCookie(c, SESSION_COOKIE);
      linkUserId = token ? (await readSessionToken(token, c.env.SESSION_SECRET)).sub : null;
      if (!linkUserId) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
    }
    const claims = {
      provider,
      state: randomToken(),
      nonce: randomToken(),
      signup: c.req.query('signup') === '1',
      linkUserId,
      returnTo: safeReturnTo(c.req.query('return')),
    };
    const redirectUri = callbackUri(c.req.url, provider);
    const target =
      provider === 'microsoft'
        ? microsoftAuthorizeUrl({ clientId: c.env.MICROSOFT_CLIENT_ID!, redirectUri, state: claims.state, nonce: claims.nonce })
        : provider === 'apple'
          ? appleAuthorizeUrl({ servicesId: c.env.APPLE_SERVICES_ID!, redirectUri, state: claims.state, nonce: claims.nonce })
          : facebookAuthorizeUrl({ appId: c.env.FACEBOOK_APP_ID!, redirectUri, state: claims.state });
    c.header('Set-Cookie', await stateCookie(claims, c.env.SESSION_SECRET, provider));
    c.header('Cache-Control', 'no-store');
    return c.redirect(target, 302);
  })

  /**
   * Phase 55, the web: the provider's answer. Microsoft and Apple POST it
   * (form_post); Facebook sends the browser back with a code. Either way the
   * browser lands on the portal again: signed in, at the sign-up step, or on
   * the sign-in page with the refusal in its words.
   */
  .on(['GET', 'POST'], ['/microsoft/callback', '/apple/callback', '/facebook/callback'], async (c) => {
    const provider = providerIn(c.req.path);
    const form = c.req.method === 'POST' ? await c.req.parseBody() : {};
    const field = (name: string) => {
      const value = c.req.method === 'POST' ? form[name] : c.req.query(name);
      return typeof value === 'string' ? value : undefined;
    };
    c.header('Cache-Control', 'no-store');
    let returnTo = '/';
    try {
      assertSignInAvailable(c.env);
      assertOffered(c.env, provider);
      const kept = await readState(getCookie(c, OAUTH_COOKIE), field('state'), provider, c.env.SESSION_SECRET);
      returnTo = kept.returnTo;
      c.header('Set-Cookie', clearedStateCookie(provider), { append: true });
      if (field('error')) throw new ApiError(401, 'unauthenticated', 'The sign-in was cancelled.');

      let identity: VerifiedIdentity;
      let revokeToken: string | null = null;
      const redirectUri = callbackUri(c.req.url, provider);
      if (provider === 'microsoft') {
        identity = await verifyMicrosoftIdToken(field('id_token') ?? '', c.env.MICROSOFT_CLIENT_ID!, { nonce: kept.nonce });
      } else if (provider === 'apple') {
        identity = await verifyAppleIdToken(field('id_token') ?? '', appleAudiences(c.env), {
          nonce: kept.nonce,
          name: appleNameFromForm(field('user')),
        });
        const code = field('code');
        if (code) revokeToken = await keepAppleToken(c.env, code, c.env.APPLE_SERVICES_ID!, redirectUri);
      } else {
        const accessToken = await exchangeFacebookCode(field('code') ?? '', {
          appId: c.env.FACEBOOK_APP_ID!,
          appSecret: c.env.FACEBOOK_APP_SECRET!,
          redirectUri,
        });
        identity = await verifyFacebookAccessToken(accessToken, c.env.FACEBOOK_APP_ID!, c.env.FACEBOOK_APP_SECRET!);
      }

      if (kept.linkUserId) {
        await linkIdentity(c.env, kept.linkUserId, identity, revokeToken);
        return c.redirect(withHash(kept.returnTo, { linked: provider }), 303);
      }
      const answer = await completeSignIn(c, identity, { asked: kept.signup, revokeToken });
      if ('signup' in answer.data) {
        const { token, email, name } = answer.data.signup;
        return c.redirect(withHash('/', { signup: token, email, name }), 303);
      }
      return c.redirect(kept.returnTo, 303);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : 'internal_error';
      const message = error instanceof ApiError ? error.message : 'Sign-in failed. Please try again.';
      if (!(error instanceof ApiError)) console.error('Sign-in callback failed', error);
      return c.redirect(withHash(returnTo, { auth_error: code, message }), 303);
    }
  })

  /** Phase 55: the reader's own ways in, for My profile. */
  .get('/identities', requireAuth, async (c) => {
    const body: ApiOk<{ identities: UserIdentity[]; offered: AuthProvider[] }> = {
      data: { identities: await listIdentities(c.env.DB, c.get('person').id), offered: offeredProviders(c.env) },
    };
    return c.json(body);
  })

  /**
   * Phase 55: adds a way in, from a token the client holds (Google's button,
   * the app's native flows). The web's redirect providers link through
   * `/start?link=1` instead.
   */
  .post('/identities/:provider', requireAuth, zValidator('json', providerSignInSchema), async (c) => {
    const provider = knownProvider(c.req.param('provider'));
    assertOffered(c.env, provider);
    await rateLimit(c, 'sign_in', clientAddress(c));
    const input = c.req.valid('json');
    const identity =
      provider === 'google'
        ? (verifyFakeToken(c.env, 'google', input.id_token ?? '') ??
          toVerified(await verifyGoogleIdToken(input.id_token ?? '', c.env.GOOGLE_CLIENT_ID)))
        : await verifyProviderInput(c.env, provider, input);
    const revokeToken =
      provider === 'apple' && input.authorization_code
        ? await keepAppleToken(c.env, input.authorization_code, appleNativeAudience(c.env))
        : null;
    await linkIdentity(c.env, c.get('person').id, identity, revokeToken);
    const body: ApiOk<UserIdentity[]> = { data: await listIdentities(c.env.DB, c.get('person').id) };
    return c.json(body, 201);
  })

  /** Phase 55: removes a way in. The last one cannot go: nobody could sign in as them. */
  .delete('/identities/:provider', requireAuth, async (c) => {
    const provider = knownProvider(c.req.param('provider'));
    const person = c.get('person');
    const mine = await listIdentities(c.env.DB, person.id);
    if (!mine.some((row) => row.provider === provider)) throw ApiError.notFound('That way in is not linked.');
    if (mine.length <= 1) {
      throw ApiError.conflict('This is your only way to sign in. Add another before removing it.');
    }
    const { revokeToken } = await removeIdentity(c.env.DB, person.id, provider);
    if (revokeToken) await revokeKeptAppleToken(c.env, revokeToken);
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'identity.removed',
      description: `${person.full_name} removed ${AUTH_PROVIDER_LABELS[provider]} from their ways to sign in`,
      entity_type: 'user',
      entity_id: person.id,
    });
    const body: ApiOk<UserIdentity[]> = { data: await listIdentities(c.env.DB, person.id) };
    return c.json(body);
  })

  /**
   * Phase 55: Apple's server-to-server notices -- a person withdrew consent or
   * deleted their Apple account. Public on purpose (Apple calls it), and
   * believed only when Apple's signature checks out. That way in is forgotten.
   */
  .post('/apple/notifications', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { payload?: string };
    const notice = body.payload ? await verifyAppleNotification(body.payload, appleAudiences(c.env)) : null;
    if (notice && (notice.type === 'consent-revoked' || notice.type === 'account-delete')) {
      if (await forgetIdentity(c.env.DB, 'apple', notice.subject)) {
        await recordAudit(c.env.DB, null, 'platform', {
          action: 'identity.removed',
          description: 'Apple reported that someone stopped using Sign in with Apple here',
        });
      }
    }
    return c.body(null, 200);
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

  /**
   * Chooses the organization the person lands in on signing in, or clears
   * the choice. Only one the person may enter now, and only their own: the
   * route takes no person. Logged in that organization's own log.
   */
  .put('/default-organization', requireAuth, zValidator('json', defaultOrganizationSchema), async (c) => {
    const { slug } = c.req.valid('json');
    const person = c.get('person');
    const memberships = await listMemberships(c.env.DB, person.id);
    const previous = memberships.find((m) => m.is_default);

    if (slug === null) {
      await setDefaultOrganization(c.env.DB, person.id, null);
      if (previous) {
        await recordAudit(c.env.DB, person, orgIdFromRow(previous.id), {
          action: 'membership.default_cleared',
          description: `${person.full_name} no longer lands in ${previous.name} on signing in`,
          subject: { id: person.id, full_name: person.full_name },
          entity_type: 'user',
          entity_id: person.id,
        });
      }
    } else {
      // An organization they cannot enter now is reported as missing.
      const chosen = memberships.find((m) => m.slug === slug && m.status === 'active');
      if (!chosen) throw ApiError.notFound('Organization not found.');

      if (previous?.slug !== chosen.slug) {
        await setDefaultOrganization(c.env.DB, person.id, orgIdFromRow(chosen.id));
        await recordAudit(c.env.DB, person, orgIdFromRow(chosen.id), {
          action: 'membership.default_set',
          description: `${person.full_name} made ${chosen.name} their default organization`,
          subject: { id: person.id, full_name: person.full_name },
          entity_type: 'user',
          entity_id: person.id,
        });
      }
    }

    const body: ApiOk<{ default_organization: string | null }> = {
      data: { default_organization: slug },
    };
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

  /**
   * Phase 52: a newcomer's age and their acceptance of the terms. Under 13: refused, and nothing
   * is stored -- no row, no log line naming them. Otherwise the person is made and signed in.
   * With sign-in off (local, the demo) a `dev_email` stands in for the token.
   */
  .post('/signup', zValidator('json', signupSchema), async (c) => {
    if (c.env.SIGNUP_OPEN === 'false') {
      throw new ApiError(403, 'forbidden', 'Sign-up is not open yet.');
    }
    const input = c.req.valid('json');
    await rateLimit(c, 'space_write', clientAddress(c));
    let claims: { sub: string | null; email: string; name: string; provider: AuthProvider };
    if (input.token) {
      const read = await readSignupToken(input.token, c.env.SESSION_SECRET);
      claims = { sub: read.sub, email: read.email.toLowerCase(), name: read.name, provider: read.provider ?? 'google' };
      if (allowlistOn(c.env)) {
        await assertInvited(c.env, { email: claims.email, provider: claims.provider, subject: claims.sub });
      }
    } else if (!isAuthEnabled(c.env) && input.dev_email) {
      claims = { sub: null, email: input.dev_email.toLowerCase(), name: input.dev_name?.trim() || input.dev_email, provider: 'google' };
    } else {
      throw ApiError.badRequest('Sign in with Google first.');
    }

    const band = ageBandFor(input.birth_year, input.birth_month, new Date());
    if (band === 'under13') {
      throw new ApiError(403, 'too_young', 'You need to be 13 or older to have an account. Ask a parent to add you to their space.');
    }
    if (input.terms_version !== TERMS_VERSION || input.privacy_version !== PRIVACY_VERSION) {
      throw ApiError.validation('Please correct the highlighted fields.', { terms_version: ['Read and accept the current terms.'] });
    }
    if (await getPersonByEmail(c.env.DB, claims.email)) {
      throw ApiError.conflict('That address already has an account. Sign in instead.');
    }

    let person: Person;
    try {
      person = await createSignedUpPerson(c.env.DB, {
        email: claims.email,
        fullName: claims.name,
        identity: claims.sub ? { provider: claims.provider, subject: claims.sub, email: claims.email } : null,
        ageBand: band,
        termsVersion: input.terms_version,
        privacyVersion: input.privacy_version,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw ApiError.conflict('That address already has an account. Sign in instead.');
      throw error;
    }
    // On the platform log: the account was made. Never the age, never a birth date.
    await recordAudit(c.env.DB, person, 'platform', {
      action: 'account.created',
      description: `${person.full_name} signed up`,
      entity_type: 'user',
      entity_id: person.id,
    });

    if (isAuthEnabled(c.env)) {
      const token = await createSessionToken(person.id, c.env.SESSION_SECRET);
      c.header('Set-Cookie', sessionCookie(token, isProduction(c.env)));
    }
    const body: ApiOk<SessionResponse> = { data: await sessionPayload(c.env, person, false, !isAuthEnabled(c.env), undefined) };
    return c.json(body, 201);
  })

  /**
   * Phase 52: a person deletes their own account, once they belong to no space and have no open
   * request. Their name, address, phone and Google id go; the platform log keeps that it happened.
   */
  .delete('/account', requireAuth, async (c) => {
    const person = c.get('person');
    if (!(await accountDeletable(c.env.DB, person.id))) {
      throw ApiError.conflict('Leave every space (or ask its administrators to remove you) before deleting your account.');
    }
    // Phase 55: Apple's rule -- its tokens are revoked when the account goes.
    for (const sealed of await appleRevokeTokens(c.env.DB, person.id)) await revokeKeptAppleToken(c.env, sealed);
    await deleteOwnAccount(c.env.DB, person.id);
    await recordAudit(c.env.DB, null, 'platform', {
      action: 'account.deleted',
      description: 'An account was deleted by its owner',
      entity_type: 'user',
      entity_id: person.id,
    });
    c.header('Set-Cookie', clearedSessionCookie(isProduction(c.env)));
    return c.body(null, 204);
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
