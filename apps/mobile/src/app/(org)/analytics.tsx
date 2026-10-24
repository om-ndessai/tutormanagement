import { AnalyticsScreen } from '@/features/dashboard/analytics-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** More → Dashboard (Phase 43): the Analytics figures that left Home. */
function AnalyticsRouteContent() {
  return <AnalyticsScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function AnalyticsRoute() {
  return (
    <FeatureGate set="tutoring">
      <AnalyticsRouteContent />
    </FeatureGate>
  );
}
