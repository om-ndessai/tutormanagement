// Ported from apps/web/src/features/auth/login-page.tsx @ 3279506 (Phase 55's provider list and wording)
import type { AuthConfig, AuthProvider, AuthProviderInfo } from '@tmi/shared';

import type { ProviderBuild } from '@/lib/provider-sign-in';

/** A provider other than Google that this build can sign in with, with what its flow needs. */
export interface UsableProvider {
  id: Exclude<AuthProvider, 'google'>;
  label: string;
  /** Microsoft's client id or Facebook's app id; null for Apple (the bundle id is the app's own). */
  clientId: string | null;
}

/**
 * Phase 55: the providers besides Google that the server offers (`/auth/config` `providers`, in its
 * order; an older Worker sends none, which is Google alone) and this build can use:
 * - Microsoft with a client id, through the browser module;
 * - Facebook with an app id, when the build registered its `fb<app id>` scheme (Android's custom tab
 *   cannot come back without it), through the browser module;
 * - Apple on iOS only, when the build has its flag on (and the device offers it: `appleReady`).
 */
export function signInProviders(
  providers: AuthProviderInfo[] | undefined,
  build: ProviderBuild,
  appleReady = build.apple,
): UsableProvider[] {
  const usable: UsableProvider[] = [];
  for (const provider of providers ?? []) {
    if (provider.id === 'google') continue;
    if (provider.id === 'microsoft' && build.browser && provider.client_id) {
      usable.push({ id: 'microsoft', label: provider.label, clientId: provider.client_id });
    } else if (
      provider.id === 'facebook' &&
      build.browser &&
      provider.client_id &&
      build.facebookAppId === provider.client_id
    ) {
      usable.push({ id: 'facebook', label: provider.label, clientId: provider.client_id });
    } else if (provider.id === 'apple' && build.platform === 'ios' && build.apple && appleReady) {
      usable.push({ id: 'apple', label: provider.label, clientId: null });
    }
  }
  return usable;
}

/** Whether the server offers Google: an older Worker lists no providers, which means Google alone. */
export function offersGoogle(config: Pick<AuthConfig, 'providers'> | null): boolean {
  const providers = config?.providers ?? [];
  return providers.length === 0 || providers.some((provider) => provider.id === 'google');
}

/** "your Google account", or "Google, Microsoft or Facebook": the sign-in card's sentence, as the web's. */
export function signInHow(google: boolean, others: { label: string }[]): string {
  const labels = [...(google ? ['Google'] : []), ...others.map((provider) => provider.label)];
  if (labels.length <= 1) return `your ${labels[0] ?? 'Google'} account`;
  return `${labels.slice(0, -1).join(', ')} or ${labels.at(-1)}`;
}
