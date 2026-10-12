// Ported from apps/web/src/features/comments/comments-button.tsx @ 1132322 (the dialog's header
// and body). One sheet serves all four kinds of target: `?target_type=&target_id=&title=&description=`.
import { useQueryClient } from '@tanstack/react-query';
import { commentTargetSchema } from '@tmi/shared';
import { View } from 'react-native';
import { Text } from 'react-native-paper';

import { useRefresh } from '@/hooks/use-refresh';
import { Screen } from '@/components/screen';
import { ErrorState } from '@/components/state-views';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { commentKeys } from './api';
import { CommentThread } from './comment-thread';

export function CommentThreadSheet({
  targetType,
  targetId,
  title,
  description,
}: {
  targetType: string | undefined;
  targetId: string | undefined;
  title: string | undefined;
  description: string | undefined;
}) {
  const theme = useAppTheme();
  const parsed = commentTargetSchema.safeParse({ target_type: targetType, target_id: targetId });
  const queryClient = useQueryClient();
  const { refreshing, onRefresh } = useRefresh(() =>
    parsed.success ? queryClient.invalidateQueries({ queryKey: commentKeys.thread(parsed.data) }) : undefined,
  );

  return (
    <Screen
      testID="screen-comments-thread"
      edges={['bottom']}
      contentStyle={{ paddingTop: space.xl }}
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={{ gap: space.xs }}>
        <Text variant="titleLarge" accessibilityRole="header">
          {title ? `Comments on ${title}` : 'Comments'}
        </Text>
        {description ? (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {description}
          </Text>
        ) : null}
      </View>
      {parsed.success ? (
        <CommentThread target={parsed.data} />
      ) : (
        <ErrorState error={new ApiRequestError(404, 'not_found', 'Nothing to comment on.')} />
      )}
    </Screen>
  );
}
