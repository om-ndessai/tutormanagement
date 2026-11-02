import { z } from 'zod';
import { AUTH_PROVIDERS, AUTH_PROVIDER_LABELS, parseAuthProviders, type AuthProvider } from './identities.js';

// ---------------------------------------------------------------------------
// Sign-in switches (Phase 62, P0 in docs/stickiness-plan.md; owner, 2026-11-01)
// ---------------------------------------------------------------------------
// Which ways in, and whether newcomers may sign up, chosen at runtime by platform
// admins in the console -- separately for the web portal and for the app -- so the
// owner can open sign-up in the production app for a demo and close it after.
//
// A Worker's vars are the defaults: AUTH_PROVIDERS (the web, and the app unless
// AUTH_PROVIDERS_APP is set) and SIGNUP_OPEN. A console setting for a client replaces
// them until it lapses (`until`), then the defaults apply again. Google is always
// offered: switching it off could lock every person, platform admins included, out.
// A provider is still offered only while this Worker has it set up (its ids and
// secrets), whatever the setting says.

/** Who is asking: the web portal, or the native app (which says so in X-Client). */
export const SIGN_IN_CLIENTS = ['web', 'app'] as const;
export type SignInClient = (typeof SIGN_IN_CLIENTS)[number];

export const SIGN_IN_CLIENT_LABELS: Record<SignInClient, string> = {
  web: 'Web portal',
  app: 'App',
};

/** The header the app sends on every request; anything else is the web. */
export const CLIENT_HEADER = 'X-Client';

/** The providers a setting may switch: every one but Google, which is always on. */
export const SWITCHABLE_PROVIDERS = AUTH_PROVIDERS.filter((provider) => provider !== 'google') as Exclude<
  AuthProvider,
  'google'
>[];

/** How long a console setting lasts before the Worker's defaults return; null is until changed. */
export const SIGN_IN_DURATIONS_HOURS = [1, 3, 12, 24] as const;

const switchableProviderSchema = z.enum(['microsoft', 'apple', 'facebook']);

/** One client's setting, as stored and as the console sends it. */
export const signInClientSettingSchema = z.object({
  /** The providers offered besides Google. */
  providers: z.array(switchableProviderSchema).max(SWITCHABLE_PROVIDERS.length),
  signup_open: z.boolean(),
  /** When the setting lapses (ISO instant), or null to keep it until changed. */
  until: z.string().datetime().nullable(),
});
export type SignInClientSetting = z.infer<typeof signInClientSettingSchema>;

/** The stored value: a setting per client, or null where the Worker's defaults apply. */
export const signInSettingsSchema = z.object({
  web: signInClientSettingSchema.nullable(),
  app: signInClientSettingSchema.nullable(),
});
export type SignInSettings = z.infer<typeof signInSettingsSchema>;

export const EMPTY_SIGN_IN_SETTINGS: SignInSettings = { web: null, app: null };

/**
 * What the console sends for one client: a setting with a duration in hours (or none, until
 * changed), or `null` to return that client to the Worker's defaults.
 */
export const updateSignInSettingSchema = z.object({
  client: z.enum(SIGN_IN_CLIENTS),
  setting: z
    .object({
      providers: z.array(switchableProviderSchema).max(SWITCHABLE_PROVIDERS.length),
      signup_open: z.boolean(),
      hours: z
        .number()
        .int()
        .refine((value) => (SIGN_IN_DURATIONS_HOURS as readonly number[]).includes(value), {
          message: 'Choose one of the durations offered.',
        })
        .nullable(),
    })
    .nullable(),
});
export type UpdateSignInSetting = z.infer<typeof updateSignInSettingSchema>;

/** The Worker's own defaults, from its vars, as the rule below reads them. */
export interface SignInDefaults {
  /** AUTH_PROVIDERS. */
  providers: string | undefined;
  /** AUTH_PROVIDERS_APP: the app's own default list; unset is AUTH_PROVIDERS. */
  appProviders: string | undefined;
  /** SIGNUP_OPEN. */
  signupOpen: string | undefined;
}

/** A client's setting while it is in force at `now`; a lapsed one is as good as none. */
export function activeSignInSetting(
  settings: SignInSettings,
  client: SignInClient,
  now: Date,
): SignInClientSetting | null {
  const setting = settings[client];
  if (!setting) return null;
  if (setting.until && Date.parse(setting.until) <= now.getTime()) return null;
  return setting;
}

/** What one client is offered: the providers (before "is it set up here") and whether sign-up is open. */
export interface EffectiveSignIn {
  providers: AuthProvider[];
  signup_open: boolean;
  /** 'console' while a setting is in force, else 'defaults'. */
  source: 'console' | 'defaults';
  until: string | null;
}

/** The rule: a setting in force wins, Google always included; otherwise the Worker's vars. */
export function effectiveSignIn(
  defaults: SignInDefaults,
  settings: SignInSettings,
  client: SignInClient,
  now: Date,
): EffectiveSignIn {
  const setting = activeSignInSetting(settings, client, now);
  if (setting) {
    const chosen = new Set<AuthProvider>(['google', ...setting.providers]);
    return {
      providers: AUTH_PROVIDERS.filter((provider) => chosen.has(provider)),
      signup_open: setting.signup_open,
      source: 'console',
      until: setting.until,
    };
  }
  const listed = parseAuthProviders(
    client === 'app' && defaults.appProviders?.trim() ? defaults.appProviders : defaults.providers,
  );
  return {
    providers: listed.includes('google') ? listed : (['google', ...listed] as AuthProvider[]),
    signup_open: defaults.signupOpen !== 'false',
    source: 'defaults',
    until: null,
  };
}

/** What the console reads: per client, what is in force and what the Worker's defaults are. */
export interface SignInClientStatus {
  client: SignInClient;
  /** In force now (before "is it set up here"). */
  effective: EffectiveSignIn;
  /** The Worker's defaults for this client, shown beside the switches. */
  defaults: { providers: AuthProvider[]; signup_open: boolean };
  /** The stored setting, lapsed or not (null: none). */
  setting: SignInClientSetting | null;
}

export interface SignInSettingsResponse {
  clients: SignInClientStatus[];
  /** The providers this Worker has set up (ids and secrets); a provider not here is never offered. */
  configured: AuthProvider[];
}

/** "Google, Microsoft and Facebook". */
export function describeProviders(providers: readonly AuthProvider[]): string {
  const labels = providers.map((provider) => AUTH_PROVIDER_LABELS[provider]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
