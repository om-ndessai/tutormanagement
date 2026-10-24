import { useLocalSearchParams } from 'expo-router';

import { RecordLessonFlow } from '@/features/teaching/session-form/record-lesson-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Record a lesson as a step flow (UI upgrades U4): Student, When, then the write-up cards. `?draft=`
 * picks a draft back up on its write-up; `?id=` writes up a lesson already on the record (from Next
 * up's "Write up the lesson"). Tutoring only: the Finance path keeps `/record-session?tab=finance`.
 */
function RecordLessonRouteContent() {
  const { id, draft } = useLocalSearchParams<{ id?: string; draft?: string }>();
  return <RecordLessonFlow sessionId={id || undefined} draftId={id ? undefined : draft || undefined} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function RecordLessonRoute() {
  return (
    <FeatureGate set="tutoring">
      <RecordLessonRouteContent />
    </FeatureGate>
  );
}
