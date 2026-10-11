// "Add to calendar" on a schedule card (ux-audit F-18, #43): the calendar app's own editor, filled
// in, where the person decides which calendar and saves. No permission is asked: iOS 17+ presents
// the editor out of process, and Android hands it to the calendar app as an intent. If that cannot
// happen (no calendar app, an older binary), the server's .ics goes to the share sheet as before.
import type { ScheduledSession } from '@tmi/shared';

import { lessonEvent } from './lesson-event';

type Schedule = Pick<
  ScheduledSession,
  'day_of_week' | 'start_time' | 'duration_minutes' | 'starts_on' | 'ends_on' | 'location'
>;

/** Resolves 'native' when the editor was shown, 'fallback' when the .ics share ran instead. */
export async function addScheduleToCalendar(
  schedule: Schedule,
  today: string,
  timeZone: string,
  fallback: () => Promise<void>,
): Promise<'native' | 'fallback'> {
  try {
    // Required here, not at the top: a binary built before expo-calendar has no native module,
    // and the share sheet still serves it.
    const Calendar = require('expo-calendar/legacy') as typeof import('expo-calendar/legacy');
    const event = lessonEvent(schedule, today, timeZone);
    await Calendar.createEventInCalendarAsync({
      ...event,
      recurrenceRule: { ...event.recurrenceRule, frequency: Calendar.Frequency.WEEKLY },
    });
    return 'native';
  } catch {
    await fallback();
    return 'fallback';
  }
}
