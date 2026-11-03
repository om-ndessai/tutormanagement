import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** More → Dashboard: the role dashboards (Phase 66 moved them off Home), with Tutoring and Finance. */
function DashboardRouteContent() {
  return <DashboardScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function AnalyticsRoute() {
  return (
    <FeatureGate set="tutoring">
      <DashboardRouteContent />
    </FeatureGate>
  );
}
