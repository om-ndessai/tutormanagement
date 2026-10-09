// Ported from apps/web/src/features/progress/student-progress-page.tsx (the delete AlertDialog and
// confirmDelete) @ 1132322 -- as a native confirmation.
import type { Assessment, LearningPlan } from '@tmi/shared';
import { Alert } from 'react-native';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useDeleteAssessment, useDeletePlan } from './api';

export type Pending = { kind: 'assessment'; row: Assessment } | { kind: 'plan'; row: LearningPlan };

export function useConfirmDelete(onDeleted?: (pending: Pending) => void) {
  const toast = useToast();
  const removeAssessment = useDeleteAssessment();
  const removePlan = useDeletePlan();

  async function remove(pending: Pending) {
    try {
      if (pending.kind === 'assessment') await removeAssessment.mutateAsync(pending.row.id);
      else await removePlan.mutateAsync(pending.row.id);
      haptics.success();
      toast.success(pending.kind === 'assessment' ? 'Assessment deleted.' : 'Plan deleted.');
      onDeleted?.(pending);
    } catch (error) {
      haptics.error();
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not delete it.');
    }
  }

  return (pending: Pending) => {
    haptics.warning();
    Alert.alert(
      `Delete this ${pending.kind === 'plan' ? 'learning plan' : 'assessment'}?`,
      pending.kind === 'plan'
        ? 'Lessons already scored against it keep their scores, but they will no longer be tied to a plan. To keep it as history, mark it achieved or closed instead.'
        : 'Its write-up and topic ratings are removed. A plan built on it stays, and falls back to the next most recent assessment.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove(pending) },
      ],
    );
  };
}
