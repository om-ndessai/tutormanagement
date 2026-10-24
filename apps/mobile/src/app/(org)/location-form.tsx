import { useLocalSearchParams } from 'expo-router';

import { LocationFormSheet } from '@/features/locations/location-form-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/** Add one of a person's tutoring locations (`?owner=`), or edit one (`&id=`), as a form sheet. */
function LocationFormRouteContent() {
  const { owner, id } = useLocalSearchParams<{ owner?: string; id?: string }>();
  return <LocationFormSheet ownerId={owner ?? ''} locationId={id} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function LocationFormRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <LocationFormRouteContent />
    </FeatureGate>
  );
}
