import { useLocalSearchParams } from 'expo-router';

import { StandardScreen } from '@/features/question-bank/standard-screen';

/** One standard's questions (`/platform/questions/NC26.4.ANR.1`). Platform admins only. */
export default function QuestionStandardRoute() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  return <StandardScreen topicId={decodeURIComponent(topicId ?? '')} />;
}
