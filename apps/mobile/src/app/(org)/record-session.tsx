import { useLocalSearchParams } from 'expo-router';

import { RecordSessionSheet } from '@/features/teaching/session-form/record-session-sheet';

/**
 * Record a lesson, or edit one (`?id=`), as a form sheet. `?tab=finance` is the only way to see
 * the money preview: opened from anywhere else, the sheet shows the length alone.
 */
export default function RecordSessionRoute() {
  const { id, tab } = useLocalSearchParams<{ id?: string; tab?: string }>();
  return <RecordSessionSheet sessionId={id || undefined} showMoney={tab === 'finance'} />;
}
