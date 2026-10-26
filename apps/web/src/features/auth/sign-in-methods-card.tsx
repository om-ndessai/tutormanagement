import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AUTH_PROVIDER_LABELS,
  type ApiOk,
  type AuthProvider,
  type UserIdentity,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError, apiClient } from '@/lib/api-client';
import { formatTimestamp } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { GoogleSignInButton } from './google-sign-in-button';
import { ProviderGlyph, providerStartHref } from './provider-buttons';

const KEY = ['auth', 'identities'] as const;

interface IdentitiesResponse {
  identities: UserIdentity[];
  offered: AuthProvider[];
}

/**
 * Phase 55: My profile's "Ways to sign in" -- the provider accounts that sign
 * this person in, one per provider. Add one by signing in with it once while
 * signed in here; remove one, but never the last. Hidden while sign-in is off.
 */
export function SignInMethodsCard() {
  const { config, impersonated } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => apiClient.get<ApiOk<IdentitiesResponse>>('/auth/identities'),
    enabled: Boolean(config?.auth_enabled) && !impersonated,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

  const linkGoogle = useMutation({
    mutationFn: (credential: string) =>
      apiClient.post<ApiOk<UserIdentity[]>>('/auth/identities/google', { id_token: credential }),
    onSuccess: () => {
      toast.success('Google added to your ways to sign in.');
      void refresh();
    },
    onError: (error) => toast.error(error instanceof ApiRequestError ? error.message : 'Could not add it.'),
  });
  const remove = useMutation({
    mutationFn: (provider: AuthProvider) => apiClient.delete<ApiOk<UserIdentity[]>>(`/auth/identities/${provider}`),
    onSuccess: (_data, provider) => {
      toast.success(`${AUTH_PROVIDER_LABELS[provider]} removed.`);
      void refresh();
    },
    onError: (error) => toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove it.'),
  });

  const data = query.data?.data;
  if (!config?.auth_enabled || impersonated || !data) return null;
  const linked = new Set(data.identities.map((row) => row.provider));
  const addable = data.offered.filter((provider) => !linked.has(provider));

  return (
    <Card className="mt-6 py-0" data-testid="sign-in-methods">
      <CardContent className="grid gap-3 p-5">
        <div>
          <h2 className="text-sm font-semibold">Ways to sign in</h2>
          <p className="text-muted-foreground text-xs">
            Each one signs you in to the same account. You need at least one.
          </p>
        </div>
        <ul className="divide-border divide-y">
          {data.identities.map((row) => (
            <li key={row.provider} className="flex flex-wrap items-center gap-3 py-2.5">
              <ProviderGlyph provider={row.provider} />
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-medium">{AUTH_PROVIDER_LABELS[row.provider]}</span>
                {row.email_at_link && <span className="text-muted-foreground"> · {row.email_at_link}</span>}
                <span className="text-muted-foreground block text-xs">
                  {row.last_used_at ? `Last used ${formatTimestamp(row.last_used_at, '')}` : 'Not used yet'}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={data.identities.length <= 1 || remove.isPending}
                onClick={() => remove.mutate(row.provider)}
                aria-label={`Remove ${AUTH_PROVIDER_LABELS[row.provider]}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {addable.length > 0 && (
          <div className="grid gap-2 border-t pt-3">
            <p className="text-muted-foreground text-xs">Add another:</p>
            <div className="flex flex-wrap items-center gap-2">
              {addable.map((provider) =>
                provider === 'google' ? (
                  config.google_client_id ? (
                    <GoogleSignInButton
                      key={provider}
                      clientId={config.google_client_id}
                      onCredential={(credential) => linkGoogle.mutate(credential)}
                      disabled={linkGoogle.isPending}
                    />
                  ) : null
                ) : (
                  <Button key={provider} variant="outline" size="sm" asChild>
                    <a href={providerStartHref(provider, { link: true, returnTo: '/profile' })}>
                      <ProviderGlyph provider={provider} />
                      {AUTH_PROVIDER_LABELS[provider]}
                    </a>
                  </Button>
                ),
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
