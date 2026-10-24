import { Link, Outlet } from 'react-router-dom';
import { FEATURE_SET_LABELS, featureOn, type FeatureSet } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';

/**
 * Phase 50: the pages of a feature set open only where the set is on here (R23). A link into one
 * from elsewhere -- an old bookmark, another space's tab -- gets a calm page, never the 403 its
 * reads would answer; the pages' queries never run.
 */
export function RequireFeature({ set }: { set: FeatureSet }) {
  const { organization } = useAuth();
  if (featureOn(organization, set)) return <Outlet />;
  return (
    <div className="mx-auto max-w-xl py-10" data-testid="feature-unavailable">
      <Card className="py-0">
        <CardContent className="grid gap-3 p-6">
          <h1 className="text-lg font-semibold">Not part of this space</h1>
          <p className="text-muted-foreground text-sm">
            {FEATURE_SET_LABELS[set]} is not switched on in {organization?.name ?? 'this space'}.
          </p>
          <div>
            <Button asChild size="sm">
              <Link to="/">Go to Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
