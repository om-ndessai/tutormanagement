// How a recorded lesson's times read on the phone: the clock strings the lesson was recorded
// with, on the organization's clock. Its DAY, an instant's clock time and the dates in a sentence
// the server wrote go through the shared formatter (`formatDay`, `formatInstantTime`,
// `readableDates` in packages/shared/src/dates.ts, Phase 78), which the web reads too.
import { formatClockTime, formatTimeRange, parseClockTime } from '@tmi/shared';

/** "4:00–5:30 PM" from "16:00" and "17:30". */
export function formatSessionTimes(startedAt: string, endedAt: string): string {
  const start = parseClockTime(startedAt);
  const end = parseClockTime(endedAt);
  if (start === null || end === null) return `${formatClockTime(startedAt)}–${formatClockTime(endedAt)}`;
  return formatTimeRange(start, end);
}
