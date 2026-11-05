import { CheckCircle2Icon, ClockIcon, XCircleIcon, XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { type MyJoinRequest } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useDismissJoinOutcome, useWithdrawRequest } from './api';

/** "Nov 4": the day a space answered. */
function answeredOn(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

/**
 * The person's own requests to join spaces and the spaces' answers (owner, 2026-11-04; UI audit JF5): a request
 * waiting, being let in ("You're in", Open) and being declined (with the date and "Ask again") -- each answer
 * until dismissed, never found only by going to look (J07 step 23, J10 steps 20-28). On the home of every space
 * (`answersOnly` on the Spaces page, which lists the open requests itself).
 */
export function RequestOutcomes({ answersOnly = false }: { answersOnly?: boolean }) {
  const { joinRequests, chooseOrganization } = useAuth();
  const dismiss = useDismissJoinOutcome();
  const withdraw = useWithdrawRequest();
  const rows = joinRequests.filter((r) => (answersOnly ? r.outcome !== null : true));
  if (rows.length === 0) return null;

  const failed = (caught: unknown, fallback: string) =>
    toast.error(caught instanceof ApiRequestError ? caught.message : fallback);

  return (
    <Card className="py-0" data-testid="home-requests" aria-label="Your requests to join spaces">
      <CardContent className="grid gap-2 p-4">
        <h2 className="text-sm font-semibold">Your requests</h2>
        <ul className="grid gap-2">
          {rows.map((r: MyJoinRequest) => (
            <li key={r.slug} className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2" data-testid={`home-request-${r.slug}`}>
              {r.outcome === 'approved' ? (
                <CheckCircle2Icon className="text-success size-4 shrink-0" aria-hidden />
              ) : r.outcome === 'declined' ? (
                <XCircleIcon className="text-destructive size-4 shrink-0" aria-hidden />
              ) : (
                <ClockIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1 basis-48 text-sm">
                {r.outcome === 'approved' ? (
                  <>You&apos;re in <strong>{r.name}</strong>.</>
                ) : r.outcome === 'declined' ? (
                  <>
                    <strong>{r.name}</strong> did not let you in{r.answered_at ? ` (${answeredOn(r.answered_at)})` : ''}.
                  </>
                ) : (
                  <>
                    Asked to join <strong>{r.name}</strong> · waiting for its admins.
                  </>
                )}
              </span>
              {r.outcome === 'approved' && (
                <Button size="sm" onClick={() => chooseOrganization(r.slug)} data-testid={`home-request-open-${r.slug}`}>
                  Open
                </Button>
              )}
              {r.outcome === 'declined' && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/spaces" data-testid={`home-request-ask-again-${r.slug}`}>
                    Ask again
                  </Link>
                </Button>
              )}
              {r.outcome === null && !answersOnly && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={withdraw.isPending}
                  onClick={() =>
                    withdraw.mutate(r.slug, {
                      onSuccess: () => toast.success(`Request to ${r.name} withdrawn.`),
                      onError: (caught) => failed(caught, 'Could not withdraw the request.'),
                    })
                  }
                  data-testid={`home-request-withdraw-${r.slug}`}
                >
                  Withdraw
                </Button>
              )}
              {r.outcome !== null && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Dismiss"
                  disabled={dismiss.isPending}
                  onClick={() => dismiss.mutate(r.slug, { onError: (caught) => failed(caught, 'Could not dismiss it.') })}
                  data-testid={`home-request-dismiss-${r.slug}`}
                >
                  <XIcon className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
