import { ProgressReportScreen } from '@/features/progress/progress-report-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Phase 58: a student's progress report, `?from=&to=&original=1`, in the in-app PDF viewer. */
function ProgressReportRouteContent() {
  return <ProgressReportScreen />;
}

/** Only where Tutoring is on here, as the progress page itself. */
export default function ProgressReportRoute() {
  return (
    <FeatureGate set="tutoring">
      <ProgressReportRouteContent />
    </FeatureGate>
  );
}
