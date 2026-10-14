import { useLocalSearchParams } from 'expo-router';

import { LocationFormSheet } from '@/features/locations/location-form-sheet';

/** Add one of a person's tutoring locations (`?owner=`), or edit one (`&id=`), as a form sheet. */
export default function LocationFormRoute() {
  const { owner, id } = useLocalSearchParams<{ owner?: string; id?: string }>();
  return <LocationFormSheet ownerId={owner ?? ''} locationId={id} />;
}
