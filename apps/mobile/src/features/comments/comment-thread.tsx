// Ported from apps/web/src/features/comments/comment-thread.tsx @ 1132322.
//
// The composer validates with the shared schema before sending, so an SSN-shaped body is refused
// on the device with the shared sentence and never leaves it.
import {
  MAX_COMMENT_LENGTH,
  commentAudienceHint,
  commentInputSchema,
  type Comment,
  type CommentTarget,
} from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';

import { Skeleton } from '@/components/skeleton';
import { ErrorState } from '@/components/state-views';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { formatInstant } from '@/features/users/people-model';
import { useAddComment, useComments } from './api';
import { CommentDeleteButton } from './comment-delete-button';

/**
 * The reverse-chronological view of everything said about one thing, with the box to add to it.
 *
 * Newest first, and the composer above the list, because a thread here is a short record of what
 * happened rather than a conversation to read in order. A target the reader may not see is the
 * server's 404, shown as "not found".
 */
export function CommentThread({ target }: { target: CommentTarget }) {
  const { data, isPending, error, refetch } = useComments(target);
  const theme = useAppTheme();
  const comments = data?.data.comments ?? [];

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <View style={{ gap: space.lg }}>
      <Composer target={target} targetName={data?.data.target_name ?? null} ready={!isPending} />

      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading comments"
          accessibilityState={{ busy: true }}
        >
          <Skeleton width="100%" height={64} style={{ borderRadius: radius.md }} />
          <Skeleton width="100%" height={64} style={{ borderRadius: radius.md }} />
        </View>
      ) : comments.length === 0 ? (
        <Text
          testID="comments-empty"
          variant="bodyMedium"
          style={{ color: theme.tokens.mutedForeground, textAlign: 'center', paddingVertical: space.xl }}
        >
          Nothing has been noted here yet.
        </Text>
      ) : (
        <View>
          {comments.map((comment, index) => (
            <CommentRow key={comment.id} comment={comment} target={target} first={index === 0} />
          ))}
        </View>
      )}
    </View>
  );
}

function Composer({
  target,
  targetName,
  ready,
}: {
  target: CommentTarget;
  targetName: string | null;
  ready: boolean;
}) {
  const theme = useAppTheme();
  const add = useAddComment();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const trimmed = body.trim();
  const nearLimit = body.length >= MAX_COMMENT_LENGTH * 0.9;

  async function submit() {
    setError(null);
    const parsed = commentInputSchema.safeParse({ ...target, body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Could not post that comment.');
      haptics.error();
      return;
    }
    try {
      await add.mutateAsync(parsed.data);
      setBody('');
      haptics.success();
    } catch (failure) {
      // Under the field rather than a toast: the thread is a sheet, which covers the app's toasts.
      setError(
        failure instanceof ApiRequestError
          ? (failure.fieldErrors.body ?? failure.message)
          : 'Could not post that comment.',
      );
      haptics.error();
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <TextInput
        testID="comments-composer"
        mode="outlined"
        accessibilityLabel="Write a comment"
        placeholder="Add a note for the people this concerns…"
        value={body}
        onChangeText={(text) => {
          setBody(text);
          if (error) setError(null);
        }}
        maxLength={MAX_COMMENT_LENGTH}
        multiline
        numberOfLines={3}
        error={Boolean(error)}
        style={{ minHeight: 88 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
        {error ? (
          <HelperText testID="comments-body-error" type="error" padding="none" style={{ flex: 1 }}>
            {error}
          </HelperText>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Text
          testID="comments-counter"
          variant="labelSmall"
          style={{ color: nearLimit ? theme.colors.error : theme.tokens.mutedForeground }}
          accessibilityLabel={`${body.length} of ${MAX_COMMENT_LENGTH} characters`}
        >
          {`${body.length} / ${MAX_COMMENT_LENGTH}`}
        </Text>
      </View>
      {/* Said plainly, because a comment about somebody is not a private note and writing one
          without knowing who reads it is how people say things they would not say to the reader's
          face. */}
      <Text testID="comments-audience" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
        {ready ? `${commentAudienceHint(target.target_type, targetName)} Comments cannot be edited.` : ' '}
      </Text>
      <Button
        testID="comments-post"
        mode="contained"
        icon="message-outline"
        onPress={() => void submit()}
        loading={add.isPending}
        disabled={!trimmed || add.isPending}
        style={{ alignSelf: 'flex-end' }}
      >
        Post
      </Button>
    </View>
  );
}

function CommentRow({ comment, target, first }: { comment: Comment; target: CommentTarget; first: boolean }) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  return (
    <View
      testID={`comment-${comment.id}`}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.sm,
        paddingVertical: space.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.colors.outlineVariant,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: space.xs }}>
        <Text variant="bodyMedium">
          <Text style={{ fontWeight: '700' }}>{comment.author_name}</Text>
          <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {` · ${formatInstant(comment.created_at, timeZone, '')}`}
          </Text>
        </Text>
        <Text variant="bodyMedium">{comment.body}</Text>
      </View>
      <CommentDeleteButton comment={comment} target={target} />
    </View>
  );
}
