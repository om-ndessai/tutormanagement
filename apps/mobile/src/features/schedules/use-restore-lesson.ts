// Ported from apps/web/src/features/schedules/lesson-cancellation.tsx @ 1132322 (RestoreLessonDialog).
// The alert dialog becomes the platform's own confirm, opened from the schedule's dates and from
// the Sessions tab's cancelled lessons panel.
import { formatDay, todayIn } from '@tmi/shared';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useRestoreLesson } from './api';

export interface RestoreTarget {
  scheduleId: string;
  occursOn: string;
  studentName: string;
}

/**
 * Restores without asking: the Undo on the toast that announced the cancellation. `mutateAsync`, not
 * `mutate` with callbacks: the Undo is pressed after the cancel sheet has gone, and a mutation's
 * per-call callbacks are skipped once the component that started it has unmounted.
 */
export function useRestoreNow() {
  const restore = useRestoreLesson();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  return useCallback(
    async (target: RestoreTarget) => {
      try {
        await restore.mutateAsync({ scheduleId: target.scheduleId, occursOn: target.occursOn });
        toast.success(`The ${formatDay(target.occursOn, todayIn(timeZone), { weekday: true })} lesson is back on.`);
      } catch (error) {
        toast.error(error instanceof ApiRequestError ? error.message : 'Could not restore the lesson.');
      }
    },
    [restore, toast, timeZone],
  );
}

/** Asks first, then puts the lesson back in its series. Offered only where `can_restore`. */
export function useConfirmRestore() {
  const restoreNow = useRestoreNow();
  const timeZone = useOrgTimeZone();
  return useCallback(
    (target: RestoreTarget) => {
      haptics.selection();
      const day = formatDay(target.occursOn, todayIn(timeZone), { weekday: true });
      Alert.alert(
        `Restore the lesson on ${day}?`,
        `${target.studentName}'s lesson that day goes back into the schedule, the dashboard and the calendar file, and counts as planned again.`,
        [
          { text: 'Leave it cancelled', style: 'cancel' },
          { text: 'Restore lesson', onPress: () => void restoreNow(target) },
        ],
      );
    },
    [restoreNow, timeZone],
  );
}
