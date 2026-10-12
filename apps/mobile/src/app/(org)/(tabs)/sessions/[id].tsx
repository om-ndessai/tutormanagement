import { useLocalSearchParams } from 'expo-router';

import { SessionDetailScreen } from '@/features/teaching/session-detail-screen';

/** One lesson (`/sessions/<id>?tab=`): money only when opened from Finance. */
export default function SessionDetailRoute() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return <SessionDetailScreen id={id} showMoney={tab === 'finance'} />;
}
