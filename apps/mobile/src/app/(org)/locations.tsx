import { OrganizationLocationsScreen } from '@/features/locations/organization-locations-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Every tutor's and student's locations, for the organization's admins (Phase 33). */
function LocationsRouteContent() {
  return <OrganizationLocationsScreen />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function LocationsRoute() {
  return (
    <FeatureGate set="tutoring">
      <LocationsRouteContent />
    </FeatureGate>
  );
}
