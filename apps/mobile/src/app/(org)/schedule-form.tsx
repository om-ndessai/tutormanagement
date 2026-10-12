import { useLocalSearchParams } from 'expo-router';

import { ScheduleFormSheet } from '@/features/schedules/schedule-form-sheet';

/** Schedule a standing weekly lesson, or edit one (`?id=<schedule>`), as a form sheet. */
export default function ScheduleFormRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ScheduleFormSheet scheduleId={id} />;
}
