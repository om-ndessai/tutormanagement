import { HomeIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useMakePersonalSpace } from '@/features/organizations/api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';

/**
 * Phase 80 (A12, docs/members-plan.md): someone a platform admin placed in a space when approving them is OFFERED a
 * space of their own rather than given one -- once, on the home, until they make it or say no thanks. Either answer
 * re-reads the session, which puts the card away; a made space is one tap away in the toast. "Make my own space"
 * stays on Spaces for anyone who says no thanks now.
 */
export function PersonalOfferCard() {
  const { personalSpaceOffer, organization, refreshSession, chooseOrganization } = useAuth();
  const answer = useMakePersonalSpace();
  if (!personalSpaceOffer) return null;

  async function respond(make: boolean) {
    try {
      const result = (await answer.mutateAsync({ make })).data;
      await refreshSession();
      const slug = result.slug;
      if (result.made && slug) {
        toast.success('Your own space is ready.', {
          duration: 10_000,
          action: { label: 'Open it', onClick: () => chooseOrganization(slug) },
        });
      }
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'That could not be saved. Try again.');
    }
  }

  return (
    <Card className="border-primary/40 py-0" data-testid="home-personal-offer">
      <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <HomeIcon className="text-primary size-5 shrink-0" aria-hidden />
        <span className="grid min-w-0 flex-1 basis-56 gap-0.5">
          <span className="font-semibold">Want a space of your own too?</span>
          <span className="text-muted-foreground" data-testid="home-personal-offer-text">
            {organization ? <>You&apos;re in {organization.name}. </> : null}A space of your own is for practising on your
            own, or with your family later.
          </span>
        </span>
        <span className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={answer.isPending}
            onClick={() => void respond(false)}
            data-testid="home-personal-offer-no"
          >
            No thanks
          </Button>
          <Button size="sm" disabled={answer.isPending} onClick={() => void respond(true)} data-testid="home-personal-offer-make">
            {answer.isPending && answer.variables?.make && <Loader2Icon className="animate-spin" />}
            Make my space
          </Button>
        </span>
      </CardContent>
    </Card>
  );
}
