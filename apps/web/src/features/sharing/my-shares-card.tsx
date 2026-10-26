import { toast } from 'sonner';
import { shareHeadline, shareUrl } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatTimestamp } from '@/lib/utils';
import { useMyShares, useWithdrawShare } from './api';

/**
 * Phase 56: the reader's own shares on the Quest page -- each link, and
 * Withdraw, after which it reads "no longer available". Hidden while there are none.
 */
export function MySharesCard() {
  const shares = useMyShares();
  const withdraw = useWithdrawShare();
  const live = (shares.data?.data ?? []).filter((share) => !share.withdrawn_at);
  if (live.length === 0) return null;
  return (
    <Card className="py-0" data-testid="my-shares">
      <CardContent className="grid gap-3 p-5">
        <h2 className="text-sm font-semibold">Your shares</h2>
        <ul className="divide-border divide-y">
          {live.map((share) => (
            <li key={share.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <a href={shareUrl(window.location.origin, share.id)} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                  {shareHeadline(share.card)}
                </a>
                <span className="text-muted-foreground block text-xs">
                  Shared {formatTimestamp(share.created_at, '')}
                </span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={withdraw.isPending}
                onClick={() =>
                  void withdraw.mutateAsync(share.id).then(() => toast.success('Withdrawn.'))
                }
              >
                Withdraw
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
