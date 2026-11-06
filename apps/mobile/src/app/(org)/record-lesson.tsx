import { SESSION_MODES } from '@tmi/shared';
import { useLocalSearchParams } from 'expo-router';

import { RecordLessonFlow } from '@/features/teaching/session-form/record-lesson-flow';
import { FeatureGate } from '@/features/shell/feature-gate';

/**
 * Record a lesson as a step flow (UI upgrades U4): Student, When, then the write-up cards. `?draft=`
 * picks a draft back up on its write-up; `?id=` writes up a lesson already on the record (from Next
 * up's "Write up the lesson"). Phase 75 (JF30): `?student&tutor&date&start&end&mode&homework` is a lesson the
 * schedule knows, written up before it is recorded (the as-planned sheet's "Write up the lesson"); with none of
 * them it is "Another lesson", a blank record with no date filled in. Tutoring only: the Finance path keeps
 * `/record-session?tab=finance`.
 */
function RecordLessonRouteContent() {
  const { id, draft, student, tutor, date, start, end, mode, homework } = useLocalSearchParams<{
    id?: string;
    draft?: string;
    student?: string;
    tutor?: string;
    date?: string;
    start?: string;
    end?: string;
    mode?: string;
    homework?: string;
  }>();
  return (
    <RecordLessonFlow
      sessionId={id || undefined}
      draftId={id ? undefined : draft || undefined}
      prefill={
        !id && !draft && student
          ? {
              student,
              tutor: tutor || undefined,
              date: date || undefined,
              start: start || undefined,
              end: end || undefined,
              mode: SESSION_MODES.find((value) => value === mode),
              ...(homework ? { homeworkReview: homework } : {}),
            }
          : undefined
      }
    />
  );
}

/** Phase 50: only where Tutoring is on here; otherwise the calm "Not part of this space". */
export default function RecordLessonRoute() {
  return (
    <FeatureGate set="tutoring">
      <RecordLessonRouteContent />
    </FeatureGate>
  );
}
