import { useLocalSearchParams } from 'expo-router';

import { RecordSessionSheet } from '@/features/teaching/session-form/record-session-sheet';

/**
 * Record a lesson, edit one (`?id=`), or pick a draft back up (`?draft=`), as a form sheet.
 * `?tab=finance` is the only way to see the money preview: opened from anywhere else, the sheet
 * shows the length alone.
 */
export default function RecordSessionRoute() {
  const { id, draft, tab } = useLocalSearchParams<{ id?: string; draft?: string; tab?: string }>();
  return (
    <RecordSessionSheet
      sessionId={id || undefined}
      draftId={id ? undefined : draft || undefined}
      showMoney={tab === 'finance'}
    />
  );
}
