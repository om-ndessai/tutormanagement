// Ported from apps/web/src/features/comments/comments-button.tsx @ 1132322. The web's dialog is a
// form sheet here, `(org)/comments-thread`; the count comes from one query for the whole list.
import type { CommentTarget } from '@tmi/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon, IconButton, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { useCommentCounts } from './api';

/** Opens the thread over the current screen. `title` is the label the opener already shows. */
export function openCommentThread(target: CommentTarget, title: string, description?: string) {
  router.push({
    pathname: '/comments-thread',
    params: { target_type: target.target_type, target_id: target.target_id, title, description },
  });
}

function useCount(target: CommentTarget): number {
  const { data } = useCommentCounts(target.target_type);
  return data?.data[target.target_id] ?? 0;
}

/** The way into a thread from a card in a list: an icon with a count badge. */
export function CommentsButton({
  target,
  title,
  description,
  testID,
}: {
  target: CommentTarget;
  title: string;
  /** The web dialog's description line: who and when, never money or notes. */
  description?: string;
  testID: string;
}) {
  const theme = useAppTheme();
  const count = useCount(target);

  return (
    <View>
      <IconButton
        testID={testID}
        icon="message-outline"
        accessibilityLabel={count > 0 ? `Comments (${count}) on ${title}` : `Comment on ${title}`}
        onPress={() => openCommentThread(target, title, description)}
        style={{ margin: 0 }}
      />
      {count > 0 ? (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 3,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.primary,
          }}
        >
          <Text
            testID={`comments-count-${target.target_id}`}
            style={{ fontSize: 10, lineHeight: 12, fontWeight: '600', color: theme.colors.onPrimary }}
          >
            {count > 9 ? '9+' : String(count)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** The way into a thread from a detail screen: a full-width row with the count. */
export function CommentsRow({
  target,
  title,
  description,
  testID,
}: {
  target: CommentTarget;
  title: string;
  /** The web dialog's description line: who and when, never money or notes. */
  description?: string;
  testID: string;
}) {
  const theme = useAppTheme();
  const count = useCount(target);
  const label = count === 0 ? 'No comments yet' : count === 1 ? '1 comment' : `${count} comments`;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Comments on ${title}: ${label}`}
      onPress={() => openCommentThread(target, title, description)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: MIN_TARGET,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        backgroundColor: pressed ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
      })}
    >
      <Icon source="message-outline" size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyLarge">Comments</Text>
        <Text
          testID={`comments-count-${target.target_id}`}
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground }}
        >
          {label}
        </Text>
      </View>
      <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
    </Pressable>
  );
}
