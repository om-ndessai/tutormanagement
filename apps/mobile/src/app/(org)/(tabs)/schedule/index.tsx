import { SchedulesScreen } from '@/features/schedules/schedules-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Standing weekly lessons (`?focus=<schedule>&on=<date>` singles one out). */
function ScheduleRouteContent() {
  return <SchedulesScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function ScheduleRoute() {
  return (
    <FeatureGate set="tutoring">
      <ScheduleRouteContent />
    </FeatureGate>
  );
}
