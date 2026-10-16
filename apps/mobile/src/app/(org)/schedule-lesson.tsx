import { ScheduleLessonFlow } from '@/features/schedules/schedule-lesson-flow';

/**
 * Schedule a standing weekly lesson as a step flow (UI upgrades U5): Who, When, From when, Where,
 * then a Review said as a sentence. Editing one stays the sheet (`/schedule-form?id=`).
 */
export default function ScheduleLessonRoute() {
  return <ScheduleLessonFlow />;
}
