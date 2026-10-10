// Ported from apps/web/src/features/platform/platform-activity-page.tsx @ 1132322.
// What the platform itself has done: organizations, their admins, platform admins. Times are
// relative ("3 minutes ago"): the console belongs to no organization, so there is no clock to put an
// absolute time on.
import { formatRelativeTime } from '@tmi/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { EmptyNote, Panel } from '@/components/section';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { usePlatformAudit } from './api';

export function PlatformActivityScreen() {
  const theme = useAppTheme();
  const audit = usePlatformAudit();
  const rows = audit.data?.data ?? [];
  const [refreshing, setRefreshing] = useState(false);
  // Native tabs may mount every tab at once (Android does): read the log afresh each time it is
  // opened, or the console's own changes since would be missing from it.
  const { refetch } = audit;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await audit.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-platform-activity" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        What the platform did. Each line is also in the affected organization’s own log.
      </Text>
      {audit.isPending ? (
        <LoadingState />
      ) : audit.isError ? (
        <ErrorState error={audit.error} onRetry={() => void audit.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyNote>Nothing yet.</EmptyNote>
      ) : (
        <Panel testID="platform-activity-list">
          <View accessibilityLabel="Platform activity">
            {rows.map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <View testID={`platform-activity-${row.id}`} style={{ paddingVertical: space.md, gap: 2 }}>
                  <Text variant="bodyMedium">{row.description}</Text>
                  <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                    {row.actor_name}
                    {row.organization_name ? ` · ${row.organization_name}` : ''} ·{' '}
                    {formatRelativeTime(row.created_at)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Panel>
      )}
    </Screen>
  );
}
