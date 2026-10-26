import { useLocalSearchParams } from 'expo-router';

import { BusinessFormSheet } from '@/features/platform/business-form-sheet';

/** Phase 54: create an organization (a business), or edit one (`?id=`), as a form sheet. Platform admins only. */
export default function BusinessFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <BusinessFormSheet id={id} />;
}
