import { useLocalSearchParams } from 'expo-router';

import { OrganizationDetailScreen } from '@/features/platform/organization-detail-screen';

export default function PlatformOrganizationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrganizationDetailScreen id={id} />;
}
