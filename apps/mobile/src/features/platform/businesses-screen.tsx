// Ported from apps/web/src/features/platform/businesses-page.tsx @ 24066d9 (working tree): the
// console's Organizations (Phase 54, `businesses` in the code) -- who families pay and who files the
// 1099s. One may run several spaces; a space with none is paid directly. Linking one to a space is on
// the space's form. Reached from the Spaces tab: the console's tab bar holds five already.
// Mobile: archiving asks first (a list row is easy to tap by accident); restoring does not.
import type { BusinessListItem } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Chip, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { OutlinedCard } from '@/components/outlined-card';
import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { EmptyNote } from '@/components/section';
import { ErrorState } from '@/components/state-views';
import { ListSkeleton } from '@/components/skeletons';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useArchiveBusiness, useBusinesses } from './api';
import { businessSummary } from './business-form';

function openForm(id?: string) {
  haptics.selection();
  router.push(id ? { pathname: '/business-form', params: { id } } : '/business-form');
}

export function BusinessesScreen() {
  const theme = useAppTheme();
  const toast = useToast();
  const businesses = useBusinesses();
  const archive = useArchiveBusiness();
  const [refreshing, setRefreshing] = useState(false);
  const rows = businesses.data?.data ?? [];

  async function onRefresh() {
    setRefreshing(true);
    try {
      await businesses.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  function toggle(row: BusinessListItem) {
    const run = async () => {
      try {
        await archive.mutateAsync({ id: row.id, archived: !row.archived_at });
        haptics.success();
        toast.success(row.archived_at ? `${row.name} restored.` : `${row.name} archived.`);
      } catch (caught) {
        haptics.error();
        // The server's words: it refuses while the organization still runs a space (409).
        toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change it.');
      }
    };
    if (row.archived_at) {
      void run();
      return;
    }
    haptics.warning();
    Alert.alert(`Archive ${row.name}?`, 'It can no longer be chosen for a space. You can restore it later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: () => void run() },
    ]);
  }

  return (
    <Screen testID="screen-platform-businesses" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <PageIntro>
        Who families pay, and who files the 1099s: a name, a TIN and a payer address. One may run several
        spaces; a space with none is paid directly, each family paying its tutor.
      </PageIntro>
      <Button
        testID="platform-business-new"
        mode="contained"
        icon="plus"
        onPress={() => openForm()}
        style={{ alignSelf: 'flex-start' }}
      >
        New organization
      </Button>

      {businesses.isPending ? (
        <ListSkeleton label="Loading organizations…" count={3} height={72} />
      ) : businesses.isError ? (
        <ErrorState error={businesses.error} onRetry={() => void businesses.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyNote>No organizations yet. Every space is paid directly.</EmptyNote>
      ) : (
        <View style={{ gap: space.sm }} accessibilityLabel="Organizations">
          {rows.map((row) => (
            <OutlinedCard
              key={row.id}
              style={{ borderRadius: radius.lg, opacity: row.archived_at ? 0.7 : 1 }}
            >
              <View
                testID={`platform-business-${row.id}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2, paddingLeft: space.xs }}>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
                  >
                    <Text variant="titleSmall" style={{ flexShrink: 1 }}>
                      {row.name}
                    </Text>
                    {row.archived_at ? (
                      <Chip testID={`platform-business-archived-${row.id}`} compact mode="outlined">
                        Archived
                      </Chip>
                    ) : null}
                  </View>
                  <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                    {businessSummary(row)}
                  </Text>
                </View>
                <IconButton
                  testID={`platform-business-edit-${row.id}`}
                  icon="pencil-outline"
                  accessibilityLabel={`Edit ${row.name}`}
                  onPress={() => openForm(row.id)}
                  style={{ margin: 0 }}
                />
                <IconButton
                  testID={`platform-business-archive-${row.id}`}
                  icon={row.archived_at ? 'archive-arrow-up-outline' : 'archive-outline'}
                  accessibilityLabel={row.archived_at ? `Restore ${row.name}` : `Archive ${row.name}`}
                  onPress={() => toggle(row)}
                  style={{ margin: 0 }}
                />
              </View>
            </OutlinedCard>
          ))}
        </View>
      )}
    </Screen>
  );
}
