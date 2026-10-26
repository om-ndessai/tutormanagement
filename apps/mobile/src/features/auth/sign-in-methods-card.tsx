// Ported from apps/web/src/features/auth/sign-in-methods-card.tsx @ 3279506
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUTH_PROVIDER_LABELS, type ApiOk, type AuthProvider, type UserIdentity } from '@tmi/shared';
import { View } from 'react-native';
import { Button, Divider, Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { formatInstant } from '@/features/users/people-model';
import { ApiRequestError, apiClient } from '@/lib/api-client';
import { googleIdToken } from '@/lib/google-sign-in';
import { haptics } from '@/lib/haptics';
import { providerToken, type ProviderToken } from '@/lib/provider-sign-in';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { PROVIDER_ICONS } from './provider-buttons';

const KEY = ['auth', 'identities'] as const;

export interface IdentitiesResponse {
  identities: UserIdentity[];
  offered: AuthProvider[];
}

/** The providers that may be added: offered, not linked yet, and usable by this build. */
export function addableProviders(
  data: IdentitiesResponse,
  usable: { google: boolean; others: AuthProvider[] },
): AuthProvider[] {
  const linked = new Set(data.identities.map((row) => row.provider));
  return data.offered.filter(
    (provider) => !linked.has(provider) && (provider === 'google' ? usable.google : usable.others.includes(provider)),
  );
}

/**
 * Phase 55: My profile's "Ways to sign in" -- the provider accounts that sign this person in, one per
 * provider. Add one by signing in with it once while signed in here; remove one, but never the last.
 * Hidden while sign-in is off (the developer sign-in has no accounts).
 */
export function SignInMethodsCard() {
  const { config, impersonated, providers, googleAvailable } = useAuth();
  const toast = useToast();
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const queryClient = useQueryClient();
  const enabled = Boolean(config?.auth_enabled) && !impersonated;
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<ApiOk<IdentitiesResponse>>('/auth/identities'),
    enabled,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const link = useMutation({
    mutationFn: ({ provider, body }: { provider: AuthProvider; body: ProviderToken }) =>
      apiClient.post<ApiOk<UserIdentity[]>>(`/auth/identities/${provider}`, body),
    onSuccess: (_data, { provider }) => {
      toast.success(`${AUTH_PROVIDER_LABELS[provider]} added to your ways to sign in.`);
      void refresh();
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not add it.');
    },
  });
  const remove = useMutation({
    mutationFn: (provider: AuthProvider) => apiClient.delete<ApiOk<UserIdentity[]>>(`/auth/identities/${provider}`),
    onSuccess: (_data, provider) => {
      toast.success(`${AUTH_PROVIDER_LABELS[provider]} removed.`);
      void refresh();
    },
    onError: (error) => {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove it.');
    },
  });

  async function add(provider: AuthProvider) {
    haptics.selection();
    try {
      if (provider === 'google') {
        const result = await googleIdToken();
        if (result.kind === 'cancelled') return;
        link.mutate({ provider, body: { id_token: result.idToken } });
        return;
      }
      const usable = providers.find((p) => p.id === provider);
      if (!usable) return;
      const result = await providerToken(usable);
      if (result.kind === 'cancelled') return;
      link.mutate({ provider, body: result.body });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not add it.');
    }
  }

  const data = query.data?.data;
  if (!enabled || !data) return null;
  const addable = addableProviders(data, {
    google: googleAvailable,
    others: providers.map((p) => p.id),
  });
  const muted = theme.tokens.mutedForeground;

  return (
    <OutlinedCard testID="sign-in-methods" style={{ borderRadius: radius.lg }} contentStyle={{ padding: space.lg }}>
      <View style={{ gap: space.md }}>
        <View style={{ gap: 2 }}>
          <Text variant="titleSmall" accessibilityRole="header">
            Ways to sign in
          </Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            Each one signs you in to the same account. You need at least one.
          </Text>
        </View>
        {data.identities.map((row, index) => (
          <View key={row.provider} style={{ gap: space.md }}>
            {index > 0 ? <Divider /> : null}
            <View
              testID={`sign-in-method-${row.provider}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <Icon source={PROVIDER_ICONS[row.provider]} size={20} color={theme.colors.onSurface} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                  {AUTH_PROVIDER_LABELS[row.provider]}
                </Text>
                {row.email_at_link ? (
                  <Text variant="bodySmall" style={{ color: muted }}>
                    {row.email_at_link}
                  </Text>
                ) : null}
                <Text variant="bodySmall" style={{ color: muted }}>
                  {row.last_used_at ? `Last used ${formatInstant(row.last_used_at, timeZone, '')}` : 'Not used yet'}
                </Text>
              </View>
              <Button
                testID={`sign-in-method-remove-${row.provider}`}
                mode="text"
                compact
                disabled={data.identities.length <= 1 || remove.isPending}
                onPress={() => remove.mutate(row.provider)}
                accessibilityLabel={`Remove ${AUTH_PROVIDER_LABELS[row.provider]}`}
                contentStyle={{ minHeight: 44 }}
              >
                Remove
              </Button>
            </View>
          </View>
        ))}
        {addable.length > 0 ? (
          <View style={{ gap: space.sm }}>
            <Divider />
            <Text variant="bodySmall" style={{ color: muted }}>
              Add another:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {addable.map((provider) => (
                <Button
                  key={provider}
                  testID={`sign-in-method-add-${provider}`}
                  mode="outlined"
                  icon={PROVIDER_ICONS[provider]}
                  disabled={link.isPending}
                  onPress={() => void add(provider)}
                  contentStyle={{ minHeight: 44 }}
                >
                  {AUTH_PROVIDER_LABELS[provider]}
                </Button>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </OutlinedCard>
  );
}
