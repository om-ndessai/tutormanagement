// Lessons | Schedule (the tab bar, revised 2026-10-15). Schedule left the tab bar to make room for
// two tabs either side of the "+", and lives inside Sessions: this switch heads both screens and
// moves between them. The `schedule` route and its stack are unchanged, so every link to it
// (`/schedule?focus=…&on=…`, Home's Today, the carousel, a comment) still lands there, and the tab
// bar lights Sessions while it is in front.
import { router } from 'expo-router';

import { SegmentedTabs, type SegmentedTab } from '@/components/segmented-tabs';

export type SessionsSection = 'lessons' | 'schedule';

const SECTIONS: readonly SegmentedTab<SessionsSection>[] = [
  { value: 'lessons', label: 'Lessons', icon: 'book-open-outline', testID: 'sessions-switch-lessons' },
  {
    value: 'schedule',
    label: 'Schedule',
    icon: 'calendar-month-outline',
    testID: 'sessions-switch-schedule',
  },
];

/** Where each half lives: two sibling tabs, so a switch is a tab change, not a push. */
const HREF = { lessons: '/sessions', schedule: '/schedule' } as const;

export function SessionsSwitch({ current }: { current: SessionsSection }) {
  return (
    <SegmentedTabs
      testID="sessions-switch"
      tabs={SECTIONS}
      value={current}
      onChange={(section) => router.navigate(HREF[section])}
    />
  );
}
