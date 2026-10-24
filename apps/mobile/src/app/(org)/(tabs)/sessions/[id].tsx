import { useLocalSearchParams } from 'expo-router';

import { SessionDetailScreen } from '@/features/teaching/session-detail-screen';
import { FeatureGate } from '@/features/shell/feature-gate';

/** One lesson (`/sessions/<id>?tab=`): money only when opened from Finance. */
function SessionDetailRouteContent() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  return <SessionDetailScreen id={id} showMoney={tab === 'finance'} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function SessionDetailRoute() {
  return (
    <FeatureGate set="tutoring">
      <SessionDetailRouteContent />
    </FeatureGate>
  );
}
