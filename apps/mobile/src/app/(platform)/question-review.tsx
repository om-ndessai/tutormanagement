import { Stack, useLocalSearchParams } from 'expo-router';

import { ReviewScreen } from '@/features/question-bank/review-screen';

/**
 * The review queue (#54), over the console's tabs so the question has the whole height.
 * `?suggested=1` (Phase 51): only what spaces suggested approving.
 */
export default function QuestionReviewRoute() {
  const { suggested } = useLocalSearchParams<{ suggested?: string }>();
  const onlySuggested = suggested === '1';
  return (
    <>
      {onlySuggested ? <Stack.Screen options={{ title: 'Suggested by spaces' }} /> : null}
      <ReviewScreen suggested={onlySuggested} />
    </>
  );
}
