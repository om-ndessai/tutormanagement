// Ported from apps/web/src/features/comments/comment-delete-button.tsx @ 1132322. The alert dialog
// becomes the platform's own confirm.
import type { Comment, CommentTarget } from '@tmi/shared';
import { AccessibilityInfo, Alert } from 'react-native';
import { IconButton } from 'react-native-paper';

import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useDeleteComment } from './api';

/**
 * Withdrawing a comment, wherever it is being read.
 *
 * Renders nothing unless the API said this viewer may do it -- which is the author and nobody
 * else, not even an admin. The decision is never taken here.
 */
export function CommentDeleteButton({ comment, target }: { comment: Comment; target: CommentTarget }) {
  const toast = useToast();
  const remove = useDeleteComment();

  if (!comment.can_delete) return null;

  function confirm() {
    haptics.warning();
    Alert.alert(
      'Delete this comment?',
      'It stops being visible to everybody it was shared with. Comments cannot be edited, so this cannot be undone by rewriting it.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            remove.mutate(
              { id: comment.id, target },
              {
                // The thread is a sheet, which covers the app's toasts: the comment leaving the list
                // is the confirmation there, said aloud for a screen reader; a failure is an alert,
                // which shows above any sheet.
                onSuccess: () => {
                  haptics.success();
                  AccessibilityInfo.announceForAccessibility('Comment deleted.');
                  toast.success('Comment deleted.');
                },
                onError: (error) => {
                  haptics.error();
                  Alert.alert(
                    'Could not delete that comment',
                    error instanceof ApiRequestError ? error.message : 'Try again in a moment.',
                  );
                },
              },
            ),
        },
      ],
    );
  }

  return (
    <IconButton
      testID={`comment-delete-${comment.id}`}
      icon="trash-can-outline"
      size={20}
      accessibilityLabel="Delete this comment"
      onPress={confirm}
      disabled={remove.isPending}
      style={{ margin: 0 }}
    />
  );
}
