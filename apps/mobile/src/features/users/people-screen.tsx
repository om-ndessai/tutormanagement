// Ported from apps/web/src/features/users/users-page.tsx @ 1132322.
//
// The directory. The list is the server's, scoped to the reader: an admin sees everyone, anyone
// else the people they work with (`visibleUserIds`), and only an admin may ask for the deactivated.
// The web pages with Previous/Next; on a phone the list grows as it is scrolled. Only an admin
// deactivates, restores or deletes, and never their own account.
import type { User } from '@tmi/shared';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';

import { useLiveBannerInset } from '@/components/live-banner-inset';
import { Skeleton } from '@/components/skeleton';
import { EmptyState, ErrorState } from '@/components/state-views';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { canActOn } from './people-model';
import { PeopleFilters, type PeopleFilterState } from './people-filters';
import { useUserActions } from './use-user-actions';
import { useUserPages } from './use-user-pages';
import { UserCard, type RowActions } from './user-card';

const INITIAL: PeopleFilterState = {
  search: '',
  role: null,
  status: null,
  includeDeleted: false,
  sort: 'full_name',
  order: 'asc',
};

export function PeopleScreen() {
  const { user: viewer } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const bannerInset = useLiveBannerInset();
  const isAdmin = viewer?.roles.includes('admin') ?? false;
  const [filters, setFilters] = useState<PeopleFilterState>(INITIAL);
  const debouncedSearch = useDebouncedValue(filters.search.trim());
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The web keeps the open record in `?view=`, so a comment in the feed -- or a link somebody
   * pastes -- can open a person directly. Here a record is its own screen; the link opens it over
   * the list, and Back returns to the list.
   */
  const params = useLocalSearchParams<{ view?: string }>();
  useEffect(() => {
    if (!params.view) return;
    const id = params.view;
    router.setParams({ view: undefined });
    router.push({ pathname: '/people/[id]', params: { id } });
  }, [params.view]);

  const filter = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      role: filters.role ?? undefined,
      status: filters.status ?? undefined,
      include_deleted: isAdmin ? filters.includeDeleted : false,
      sort: filters.sort,
      order: filters.order,
    }),
    [
      debouncedSearch,
      filters.role,
      filters.status,
      filters.includeDeleted,
      filters.sort,
      filters.order,
      isAdmin,
    ],
  );

  const { data, isPending, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useUserPages(filter);
  const users = useMemo(() => data?.pages.flatMap((page) => page.data) ?? [], [data]);
  const total = data?.pages[0]?.meta.total ?? 0;

  const { deactivate, restore, hardDelete, dialog } = useUserActions();
  const actions: RowActions = {
    onView: (user: User) => router.push({ pathname: '/people/[id]', params: { id: user.id } }),
    onDeactivate: deactivate,
    onRestore: restore,
    onDelete: hardDelete,
  };

  const renderItem = ({ item }: { item: User }) => (
    <View style={{ paddingBottom: space.md }}>
      <UserCard user={item} actions={actions} canAct={canActOn(viewer, item)} />
    </View>
  );

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
      <Text testID="people-description" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        {`Everyone at ${brand.name}. A person can hold more than one role.`}
      </Text>
      <PeopleFilters
        value={filters}
        onChange={(next) => setFilters((current) => ({ ...current, ...next }))}
        isAdmin={isAdmin}
      />
      {error ? <ErrorState error={error} onRetry={() => void refetch()} /> : null}
      {isPending ? (
        <View
          style={{ gap: space.md }}
          accessibilityLabel="Loading users"
          accessibilityState={{ busy: true }}
        >
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} width="100%" height={88} style={{ borderRadius: radius.lg }} />
          ))}
        </View>
      ) : null}
    </View>
  );

  const footer =
    users.length > 0 ? (
      <View style={{ paddingVertical: space.md, alignItems: 'center', gap: space.sm }}>
        {isFetchingNextPage ? <ActivityIndicator accessibilityLabel="Loading more" /> : null}
        <Text
          testID="people-count"
          variant="bodySmall"
          style={{ color: theme.tokens.mutedForeground }}
          accessibilityLiveRegion="polite"
        >
          {`Showing ${users.length} of ${total}`}
          {isFetching && !isFetchingNextPage && !refreshing ? ' · updating…' : ''}
        </Text>
      </View>
    ) : null;

  return (
    <>
      <Stack.Screen options={{ title: 'Users' }} />
      <FlashList
        testID="screen-people"
        data={users}
        keyExtractor={(user) => user.id}
        renderItem={renderItem}
        extraData={viewer?.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          isPending || error ? null : (
            <EmptyState
              testID="people-empty"
              icon="account-search-outline"
              title="No users match these filters."
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + bannerInset }}
      />
      {dialog}
    </>
  );
}
