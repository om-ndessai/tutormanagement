import { useLocalSearchParams } from 'expo-router';

import { CancelLessonSheet } from '@/features/schedules/cancel-lesson-sheet';

/** Call off one lesson of a series (`?schedule=<id>[&date=<YYYY-MM-DD>]`), as a form sheet. */
export default function CancelLessonRoute() {
  const { schedule, date } = useLocalSearchParams<{ schedule?: string; date?: string }>();
  return <CancelLessonSheet scheduleId={schedule} date={date} />;
}
