import { useLocalSearchParams } from 'expo-router';

import { AssessSessionSheet } from '@/features/teaching/assess-session-sheet';

/** The reader's own assessment of one lesson, as a form sheet (`?session=<id>`). */
export default function AssessSessionRoute() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  return <AssessSessionSheet sessionId={session} />;
}
