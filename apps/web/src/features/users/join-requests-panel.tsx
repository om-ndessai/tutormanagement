import { useState } from 'react';
import { toast } from 'sonner';
import { formatRelativeTime, type JoinRequest, JOIN_REQUEST_ROLE_LABELS } from '@tmi/shared';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDeclineJoinRequest, useJoinRequests, useRefreshJoinRequests } from '@/features/organizations/api';
import { LetInSheet } from './let-in-sheet';

/**
 * Phase 52: people who asked to join with the space's code. Its admins only (R21). Letting someone in is a
 * short sheet that asks the role and, for a parent, which child is theirs (owner, 2026-11-04; UI audit JF1);
 * a request shows the whole address and when it was asked at every width, and Decline asks first, as the
 * app does (JF26).
 */
export function JoinRequestsPanel() {
  const requests = useJoinRequests(true);
  const decline = useDeclineJoinRequest();
  const refresh = useRefreshJoinRequests();
  const [letting, setLetting] = useState<JoinRequest | null>(null);
  const [declining, setDeclining] = useState<JoinRequest | null>(null);
  const rows = requests.data?.data ?? [];
  // One `now` for every row (Phase 78), so two requests asked together read alike.
  const now = new Date();
  if (rows.length === 0 && !letting) return null;

  return (
    <section className="mb-6 grid gap-2" aria-label="Requests to join" data-testid="join-requests">
      {rows.length > 0 && (
        <h2 className="text-muted-foreground text-[13px] font-semibold">
          Requests to join <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5">{rows.length}</span>
        </h2>
      )}
      {rows.map((r) => (
        <Card key={r.user_id} className="py-0" data-testid={`join-request-${r.user_id}`}>
          {/* Phase 78 (JF28): below sm the words come first and the actions take a line of their own. */}
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="min-w-0 sm:flex-1 sm:basis-56">
              <p className="font-medium break-words">{r.full_name}</p>
              <p className="text-muted-foreground text-xs [overflow-wrap:anywhere]">{r.email ?? 'No address'}</p>
              <p className="text-muted-foreground text-xs">
                asked {formatRelativeTime(r.requested_at, now)}
                {r.role ? ` · as ${JOIN_REQUEST_ROLE_LABELS[r.role].toLowerCase()}` : ''}
              </p>
              {/* Their own words, for the admins only (R32). */}
              {r.note && (
                <p className="mt-1 text-sm break-words" data-testid={`join-request-note-${r.user_id}`}>
                  “{r.note}”
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2" data-testid={`join-request-actions-${r.user_id}`}>
              <Button size="sm" onClick={() => setLetting(r)} data-testid={`join-request-let-in-${r.user_id}`}>
                Let in
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeclining(r)} data-testid={`join-request-decline-${r.user_id}`}>
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {letting && (
        <LetInSheet
          request={letting}
          onClose={() => setLetting(null)}
          onLetIn={() => void refresh()}
          onDone={() => {
            setLetting(null);
            void refresh();
          }}
        />
      )}
      <AlertDialog open={declining !== null} onOpenChange={(open) => !open && setDeclining(null)}>
        <AlertDialogContent data-testid="join-request-decline-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Decline {declining?.full_name}&apos;s request?</AlertDialogTitle>
            <AlertDialogDescription>
              They will see that this space did not let them in. They can ask again with the code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={decline.isPending}
              onClick={() => {
                const who = declining;
                if (!who) return;
                decline.mutate(who.user_id, { onSuccess: () => toast.success(`${who.full_name}’s request declined.`) });
                setDeclining(null);
              }}
              data-testid="join-request-decline-yes"
            >
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
