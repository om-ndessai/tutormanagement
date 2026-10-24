import { SESSION_MODES, type SessionMode } from '@tmi/shared';
import { useLocalSearchParams } from 'expo-router';

import { StartLessonSheet } from '@/features/teaching/start-lesson-sheet';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Start a live lesson with one of the tutor's students, as a form sheet. Home's Next up card opens it
 * with `?student=<id>&mode=<mode>` already chosen (#43).
 */
function StartLessonRouteContent() {
  const { student, mode } = useLocalSearchParams<{ student?: string; mode?: string }>();
  const initialMode = SESSION_MODES.find((value) => value === mode) as SessionMode | undefined;
  return <StartLessonSheet initialStudent={student || undefined} initialMode={initialMode} />;
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function StartLessonRoute() {
  return (
    <FeatureGate set="tutoring" presentation="sheet">
      <StartLessonRouteContent />
    </FeatureGate>
  );
}
