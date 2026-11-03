import type { Context } from 'hono';
import {
  CLIENT_HEADER,
  effectiveSignIn,
  type AuthProvider,
  type EffectiveSignIn,
  type SignInClient,
  type SignInDefaults,
} from '@tmi/shared';

import { getSignInSettings } from '../repositories/platform-settings.js';
import type { AppEnv, Env } from '../types.js';
import { offeredProviders } from './identity.js';

/**
 * Phase 62 (P0): who is asking. The app says so on every request (`X-Client: app`); anything else --
 * a browser, an app build from before this header -- is the web. This picks which switches apply,
 * not who may do what: a provider still verifies every identity, so a browser claiming to be the app
 * gains nothing but the app's buttons.
 */
export function clientOf(c: Context<AppEnv>): SignInClient {
  return c.req.header(CLIENT_HEADER)?.trim().toLowerCase() === 'app' ? 'app' : 'web';
}

/** The Worker's own defaults, from its vars. */
export function signInDefaults(env: Env): SignInDefaults {
  return { providers: env.AUTH_PROVIDERS, appProviders: env.AUTH_PROVIDERS_APP, signupOpen: env.SIGNUP_OPEN };
}

export interface ClientSignIn extends EffectiveSignIn {
  /** In force AND set up on this Worker: what the client is actually offered. */
  offered: AuthProvider[];
}

/**
 * What one client is offered now: the console's setting while it is in force, else the vars. An address
 * that never takes sign-ups (SIGNUP_ALLOWED "false", `tmi-portal`) stays closed whatever the console says,
 * as GUEST_PLAY keeps guest play off there: the console runs the platform, the deploy decides the address.
 */
export async function signInFor(env: Env, client: SignInClient, now = new Date()): Promise<ClientSignIn> {
  const settings = await getSignInSettings(env.DB, now.getTime());
  const effective = effectiveSignIn(signInDefaults(env), settings, client, now);
  const signup_open = effective.signup_open && env.SIGNUP_ALLOWED !== 'false';
  return { ...effective, signup_open, offered: offeredProviders(env, effective.providers) };
}
