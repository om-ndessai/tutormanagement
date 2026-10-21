import { SESSION_MODES } from '@tmi/shared';
import { useLocalSearchParams } from 'expo-router';

import { RecordAsPlannedSheet } from '@/features/teaching/session-form/record-as-planned-sheet';

/**
 * Record the lesson at hand from Home's Next up card (UI upgrades U4), or a finished one from the
 * tutor's Now card (Phase 43): a quick sheet filled from the scheduled lesson
 * (`?student&tutor&date&start&end&mode&place`, and `homework`, the Homework review's first line).
 */
export default function RecordAsPlannedRoute() {
  const { student, tutor, date, start, end, mode, place, homework } = useLocalSearchParams<{
    student?: string;
    tutor?: string;
    date?: string;
    start?: string;
    end?: string;
    mode?: string;
    place?: string;
    homework?: string;
  }>();
  return (
    <RecordAsPlannedSheet
      prefill={{
        student: student ?? '',
        tutor: tutor || undefined,
        date: date || undefined,
        start: start || undefined,
        end: end || undefined,
        mode: SESSION_MODES.find((value) => value === mode),
        ...(homework ? { homeworkReview: homework } : {}),
      }}
      place={place || undefined}
    />
  );
}
