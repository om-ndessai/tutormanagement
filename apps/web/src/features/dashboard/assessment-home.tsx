import { Link } from 'react-router-dom';
import { featureAllowed, featureOn } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { AssessmentList, StartCard } from '@/features/canvas-assessments/assessments-page';
import { useCanvasAssessments } from '@/features/canvas-assessments/api';

/**
 * Phase 50: the home of a space without Tutoring -- a space allowed Assessment
 * alone, as every self-serve space is (Phase 52). Its students and their
 * assessments, from the Assessment menu's own reads: no dashboard call, since
 * the dashboard is Tutoring's and answers 403 here.
 */
export function AssessmentHome() {
  const brand = useBrand();
  const { user, organization } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const on = featureOn(organization, 'assessment');
  const list = useCanvasAssessments({ enabled: on });
  const rows = list.data?.data ?? [];
  const waiting = rows.filter((row) => row.status === 'submitted' && !row.reviewed_at && row.can_review).length;

  return (
    <div className="mx-auto grid max-w-6xl gap-6" data-testid="assessment-home">
      <PageHeader
        title="Home"
        description={
          on
            ? `${brand.name}: assessments answered by hand, one question a page, with a PDF for whoever reviews them.`
            : brand.name
        }
      />
      {!on ? (
        <Card className="py-0" data-testid="assessment-home-off">
          <CardContent className="grid gap-3 p-6">
            <p className="font-medium">Nothing is switched on in this space yet.</p>
            <p className="text-muted-foreground text-sm">
              {featureAllowed(organization, 'assessment')
                ? isAdmin
                  ? 'Switch on the Assessment menu on the Space page to start one.'
                  : 'Ask the space’s administrators to switch on the Assessment menu.'
                : 'Ask the space’s administrators which features it offers.'}
            </p>
            {isAdmin && featureAllowed(organization, 'assessment') && (
              <div>
                <Button asChild size="sm">
                  <Link to="/organization">Open the Space page</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {waiting > 0 && (
            <p className="text-sm" data-testid="assessment-home-waiting">
              <span className="font-medium">{waiting}</span> {waiting === 1 ? 'assessment is' : 'assessments are'} waiting for your
              review.
            </p>
          )}
          <StartCard />
          <AssessmentList />
        </>
      )}
    </div>
  );
}
