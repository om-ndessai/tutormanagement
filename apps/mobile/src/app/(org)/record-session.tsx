import { SESSION_MODES } from '@tmi/shared';
import { useLocalSearchParams } from 'expo-router';

import { RecordSessionSheet } from '@/features/teaching/session-form/record-session-sheet';

/**
 * Record a lesson, edit one (`?id=`), or pick a draft back up (`?draft=`), as a form sheet.
 * `?tab=finance` is the only way to see the money preview: opened from anywhere else, the sheet
 * shows the length alone. Home's Next up card opens a new one filled in from the scheduled lesson
 * (`?student&tutor&date&start&end&mode`, #43).
 */
export default function RecordSessionRoute() {
  const { id, draft, tab, student, tutor, date, start, end, mode } = useLocalSearchParams<{
    id?: string;
    draft?: string;
    tab?: string;
    student?: string;
    tutor?: string;
    date?: string;
    start?: string;
    end?: string;
    mode?: string;
  }>();
  return (
    <RecordSessionSheet
      sessionId={id || undefined}
      draftId={id ? undefined : draft || undefined}
      showMoney={tab === 'finance'}
      prefill={
        student
          ? {
              student,
              tutor: tutor || undefined,
              date: date || undefined,
              start: start || undefined,
              end: end || undefined,
              mode: SESSION_MODES.find((value) => value === mode),
            }
          : undefined
      }
    />
  );
}
