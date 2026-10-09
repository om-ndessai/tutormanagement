// Ported from apps/web/src/features/comments/comments-page.tsx @ 1132322. The web's select becomes
// wrapping chips, and Previous/Next a list that pages as it scrolls.
import {
  COMMENT_TARGET_LABELS,
  COMMENT_TARGET_TYPES,
  type CommentFeedEntry,
  type CommentTargetType,
} from '@tmi/shared';
import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Chip, Icon, Text } from 'react-native-paper';

import { useLiveBannerInset } from '@/components/live-banner-inset';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { formatInstant } from '@/features/users/people-model';
import { haptics } from '@/lib/haptics';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { CommentDeleteButton } from './comment-delete-button';
import { FILTER_LABELS, TARGET_ICONS, commentTargetHref } from './comment-targets';
import { useCommentFeedPages } from './use-comment-feed-pages';

/**
 * Every comment the viewer may read, in one place.
 *
 * The same visibility rules as each individual thread -- this is a different view of the same
 * remarks, never a wider one -- so what a parent finds here is their own family's, and what an
 * admin finds is the organization's.
 */
export function CommentsScreen() {
  const theme = useAppTheme();
  const bannerInset = useLiveBannerInset();
  const [targetType, setTargetType] = useState<CommentTargetType | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useCommentFeedPages(targetType);
  const entries = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const total = data?.pages[0]?.meta.total ?? 0;

  function choose(next: CommentTargetType | undefined) {
    if (next === targetType) return;
    haptics.selection();
    setTargetType(next);
  }

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.lg }}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        Everything that has been said about the people and lessons you work with, newest first.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityLabel="About">
        <Chip
          testID="comments-filter-all"
          selected={targetType === undefined}
          showSelectedCheck={false}
          mode={targetType === undefined ? 'flat' : 'outlined'}
          onPress={() => choose(undefined)}
        >
          Everything
        </Chip>
        {COMMENT_TARGET_TYPES.map((type) => (
          <Chip
            key={type}
            testID={`comments-filter-${type}`}
            selected={targetType === type}
            showSelectedCheck={false}
            mode={targetType === type ? 'flat' : 'outlined'}
            onPress={() => choose(targetType === type ? undefined : type)}
          >
            {FILTER_LABELS[type]}
          </Chip>
        ))}
      </View>
      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading comments"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="100%" height={88} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : null}
    </View>
  );

  const footer =
    entries.length > 0 ? (
      <View style={{ paddingVertical: space.md, alignItems: 'center', gap: space.sm }}>
        {isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Loading more" /> : null}
        <Text
          testID="comments-feed-footer"
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground }}
          accessibilityLiveRegion="polite"
        >
          {`Showing ${entries.length} of ${total}`}
        </Text>
      </View>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Comments' }} />
      <FlashList
        testID="screen-comments"
        data={entries}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => <FeedRow entry={item} />}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          isPending || error ? null : (
            <EmptyState
              testID="comments-feed-empty"
              icon="message-text-outline"
              title={
                targetType === undefined
                  ? 'Nothing has been commented on yet.'
                  : `No comments on ${COMMENT_TARGET_LABELS[targetType]}s yet.`
              }
            />
          )
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={() => void onRefresh()}
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + bannerInset }}
      />
    </>
  );
}

function FeedRow({ entry }: { entry: CommentFeedEntry }) {
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const muted = theme.tokens.mutedForeground;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.xs,
        paddingVertical: space.xs,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.outlineVariant,
      }}
    >
      {/* The row opens what the comment is about. */}
      <Pressable
        testID={`comments-feed-row-${entry.id}`}
        accessibilityRole="link"
        accessibilityLabel={`${entry.author_name} on ${entry.target_label}: ${entry.body}`}
        onPress={() => router.push(commentTargetHref(entry))}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: space.md,
          paddingVertical: space.sm,
          borderRadius: radius.md,
          backgroundColor: pressed ? withAlpha(theme.colors.primary, 0.08) : 'transparent',
        })}
      >
        <View
          style={{
            marginTop: 2,
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.tokens.muted,
          }}
        >
          <Icon source={TARGET_ICONS[entry.target_type]} size={16} color={muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant="bodyMedium">
            <Text style={{ fontWeight: '700' }}>{entry.author_name}</Text>
            <Text style={{ color: muted }}> on </Text>
            <Text style={{ color: theme.colors.primary }}>{entry.target_label}</Text>
          </Text>
          <Text variant="bodySmall" style={{ color: muted }}>
            {formatInstant(entry.created_at, timeZone, '')}
          </Text>
          <Text variant="bodyMedium" style={{ marginTop: space.xs }}>
            {entry.body}
          </Text>
        </View>
      </Pressable>
      <View style={{ paddingTop: space.sm }}>
        <CommentDeleteButton
          comment={entry}
          target={{ target_type: entry.target_type, target_id: entry.target_id }}
        />
      </View>
    </View>
  );
}
