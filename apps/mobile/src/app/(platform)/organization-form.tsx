import { useLocalSearchParams } from 'expo-router';

import { OrganizationFormSheet } from '@/features/platform/organization-form-sheet';

/** Create an organization, or edit one (`?id=`), as a form sheet. Platform admins only. */
export default function OrganizationFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <OrganizationFormSheet id={id} />;
}
