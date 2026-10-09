// Ported from apps/web/src/features/audit/activity-page.tsx @ 1132322. The filters move into a bottom
// sheet, Previous/Next into a list that pages as it scrolls, and the feed gains day headings on the
// organization's clock.
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Badge, Button, Chip, Text } from 'react-native-paper';

import { useLiveBannerInset } from '@/components/live-banner-inset';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { organizationToday } from '@/features/teaching/session-ranges';
import { useUsers } from '@/features/users/api';
import { useAuth, useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { ActivityRow } from './activity-feed';
import { ActivityFiltersSheet } from './activity-filters-sheet';
import {
  activeFilterCount,
  filterChips,
  groupByDay,
  type ActivityFilter,
  type FilterKey,
  type TimelineItem,
} from './activity-model';
import { useAuditPages } from './use-audit-pages';

/**
 * "Admin should have ability to see the user activity within the entire system as well as for
 * individual user." Both live here: the person filter narrows the same feed. Anyone else sees only
 * their own activity -- the server's restriction, whatever is asked.
 */
export function ActivityScreen() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const timeZone = useOrgTimeZone();
  const today = organizationToday(timeZone);
  const bannerInset = useLiveBannerInset();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const sheet = useRef<BottomSheetModal>(null);
  const [filter, setFilter] = useState<ActivityFilter>({});
  const [refreshing, setRefreshing] = useState(false);

  // Never send a person for a non-admin: the server would answer with their own log anyway.
  const sent: ActivityFilter = useMemo(
    () => (isAdmin ? filter : { ...filter, user_id: undefined }),
    [filter, isAdmin],
  );
  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAuditPages(sent);
  const events = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const total = data?.pages[0]?.meta.total ?? 0;
  const items = useMemo(() => groupByDay(events, timeZone, today), [events, timeZone, today]);

  // The chip names the chosen person from the same cached list the sheet offers.
  const users = useUsers({ limit: 100, sort: 'full_name' }, { enabled: isAdmin });
  const nameOf = (id: string) => users.data?.data.find((candidate) => candidate.id === id)?.full_name;
  const chips = filterChips(sent, nameOf, today);
  const count = activeFilterCount(sent);

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
      <Text
        testID="activity-description"
        variant="bodyMedium"
        style={{ color: theme.tokens.mutedForeground }}
      >
        {isAdmin
          ? 'Everything that has happened in the portal, newest first.'
          : 'Your activity in the portal, newest first.'}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        <View>
          <Button
            testID="activity-filters-open"
            mode="outlined"
            icon="filter-variant"
            accessibilityLabel={count > 0 ? `Filters, ${count} on` : 'Filters'}
            onPress={() => sheet.current?.present()}
          >
            Filters
          </Button>
          {count > 0 ? (
            <Badge
              testID="activity-filter-count"
              size={18}
              // The brand's colour, not Paper's default error red: a filter is not a fault.
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: theme.colors.primary,
                color: theme.colors.onPrimary,
              }}
            >
              {count}
            </Badge>
          ) : null}
        </View>
        {count > 0 ? (
          <Button testID="activity-clear" mode="text" compact onPress={() => setFilter({})}>
            Clear
          </Button>
        ) : null}
      </View>
      {chips.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              testID={`activity-chip-${chipId(chip.key)}`}
              onPress={() => sheet.current?.present()}
              onClose={() => setFilter((current) => ({ ...current, [chip.key]: undefined }))}
              style={{ maxWidth: '100%' }}
              textStyle={{ flexShrink: 1 }}
              closeIconAccessibilityLabel={`Remove ${chip.label}`}
            >
              {chip.label}
            </Chip>
          ))}
        </View>
      ) : null}
      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.lg }}
          accessibilityLabel="Loading activity"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2, 3].map((index) => (
            <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
              <Skeleton width={32} height={32} style={{ borderRadius: 16 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="66%" height={16} />
                <Skeleton width={96} height={12} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  const footer =
    events.length > 0 ? (
      <View style={{ paddingVertical: space.md, alignItems: 'center', gap: space.sm }}>
        {isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Loading more" /> : null}
        <Text
          testID="activity-footer"
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground }}
          accessibilityLiveRegion="polite"
        >
          {`Showing ${events.length} of ${total}`}
        </Text>
      </View>
    ) : null;

  const renderItem = ({ item }: { item: TimelineItem }) =>
    item.kind === 'day' ? (
      <Text
        testID={`activity-day-${item.day}`}
        variant="labelLarge"
        accessibilityRole="header"
        style={{ color: theme.tokens.mutedForeground, paddingTop: space.md, paddingBottom: space.xs }}
      >
        {item.label}
      </Text>
    ) : (
      <ActivityRow event={item.event} last={item.last} />
    );

  return (
    <>
      <Stack.Screen options={{ title: 'Activity' }} />
      <FlashList
        testID="screen-activity"
        data={items}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          isPending || error ? null : (
            <EmptyState
              testID="activity-empty-list"
              icon="history"
              title={count > 0 ? 'No activity matches these filters.' : 'No activity recorded yet.'}
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
      <ActivityFiltersSheet
        sheetRef={sheet}
        filter={filter}
        onChange={setFilter}
        isAdmin={isAdmin}
        today={today}
      />
    </>
  );
}

function chipId(key: FilterKey): string {
  return key === 'user_id' ? 'person' : key;
}
