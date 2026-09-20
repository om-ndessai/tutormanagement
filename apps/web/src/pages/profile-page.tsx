import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { useUserDetail } from '@/features/users/api';
import { UserDetailView } from '@/features/users/user-detail-view';
import { useAuth } from '@/providers/auth-provider';

/**
 * Where a successful Google sign-in lands: the portal's own record of the
 * person whose email matched the Google account, now including everything the
 * Phase 2 model knows about them.
 */
export function ProfilePage() {
  const { user, impersonated } = useAuth();
  const { data, isPending, isError } = useUserDetail(user?.id ?? null);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="My profile"
        description="How the Mathematics Institute of the Triangle has you on file."
      />

      {impersonated && (
        <div className="border-warning/40 bg-warning/10 mb-6 flex items-start gap-2 rounded-md border p-3">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Authentication is switched off</p>
            <p className="text-muted-foreground mt-1 text-xs">
              The API is running with <code className="font-mono">AUTH_ENABLED=false</code> and
              treating every request as {user.full_name}. Turn it back on before deploying.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent>
          {isPending && (
            <p className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Loading your record…
            </p>
          )}

          {isError && (
            <p className="text-destructive py-8 text-sm">Could not load your record.</p>
          )}

          {data && <UserDetailView user={data.data} />}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 text-center text-xs">
        Something wrong here? Ask an administrator to update your record.
      </p>
    </div>
  );
}
