import { useState } from 'react';
import { toast } from 'sonner';
import { formatRelativeTime, type JoinRequest } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDeclineJoinRequest, useJoinRequests, useRefreshJoinRequests } from '@/features/organizations/api';
import { UserFormDialog } from './user-form-dialog';

/**
 * Phase 52: people who asked to join with the space's code. Letting someone in opens the usual
 * form, prefilled, to choose their roles -- the usual rules apply (a student needs a parent here).
 * Its admins only (R21).
 */
export function JoinRequestsPanel() {
  const requests = useJoinRequests(true);
  const decline = useDeclineJoinRequest();
  const refresh = useRefreshJoinRequests();
  const [letting, setLetting] = useState<JoinRequest | null>(null);
  const rows = requests.data?.data ?? [];
  if (rows.length === 0) return null;

  return (
    <section className="mb-6 grid gap-2" aria-label="Requests to join" data-testid="join-requests">
      <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        Requests to join <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5">{rows.length}</span>
      </h2>
      {rows.map((r) => (
        <Card key={r.user_id} className="py-0" data-testid={`join-request-${r.user_id}`}>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.full_name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {r.email} · asked {formatRelativeTime(r.requested_at)}
              </p>
            </div>
            <Button size="sm" onClick={() => setLetting(r)} data-testid={`join-request-let-in-${r.user_id}`}>
              Let in
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={decline.isPending}
              onClick={() => decline.mutate(r.user_id, { onSuccess: () => toast.success(`${r.full_name}’s request declined.`) })}
              data-testid={`join-request-decline-${r.user_id}`}
            >
              Decline
            </Button>
          </CardContent>
        </Card>
      ))}
      {letting && (
        <UserFormDialog
          open
          onOpenChange={(open) => !open && setLetting(null)}
          userId={null}
          preset={{ roles: [], full_name: letting.full_name, email: letting.email ?? '' }}
          joinRequestUserId={letting.user_id}
          title={`Let ${letting.full_name} in`}
          description="Choose what they do here. They are a member as soon as you save."
          onSaved={() => {
            setLetting(null);
            void refresh();
          }}
        />
      )}
    </section>
  );
}
