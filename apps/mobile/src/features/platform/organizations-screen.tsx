// Ported from apps/web/src/features/platform/organizations-page.tsx @ 1132322.
// Every organization on the platform, and the way in to creating the next. Archiving moved to the
// organization's own screen, behind a confirm: a list row is too easy to tap by accident.
import { ORG_PALETTE_LABELS, type OrganizationListItem } from '@tmi/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Chip, Icon, Text, TouchableRipple } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { EmptyNote } from '@/components/section';
import { ErrorState, LoadingState } from '@/components/state-views';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useOrganizations } from './api';

export function orgSummary(org: OrganizationListItem): string {
  return (
    `${org.slug} · ${ORG_PALETTE_LABELS[org.palette]} · ${org.admin_count} ` +
    `${org.admin_count === 1 ? 'admin' : 'admins'} · ${org.member_count} ` +
    `${org.member_count === 1 ? 'member' : 'members'}`
  );
}

export function OrganizationsScreen() {
  const organizations = useOrganizations();
  const { user } = useAuth();
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  // Archived ones after the live ones, otherwise in the server's order.
  const rows = [...(organizations.data?.data ?? [])].sort(
    (a, b) => Number(Boolean(a.archived_at)) - Number(Boolean(b.archived_at)),
  );

  async function onRefresh() {
    setRefreshing(true);
    try {
      await organizations.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Screen testID="screen-platform" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
        Each one has its own people, records and look. Create one, then add its first admin.
      </Text>
      <Button
        testID="platform-org-new"
        mode="contained"
        icon="plus"
        onPress={() => {
          haptics.selection();
          router.push('/organization-form');
        }}
        style={{ alignSelf: 'flex-start' }}
      >
        New organization
      </Button>

      {organizations.isPending ? (
        <LoadingState label="Loading organizations…" />
      ) : organizations.isError ? (
        <ErrorState error={organizations.error} onRetry={() => void organizations.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyNote>
          No organizations yet. Create the first, then add its admin — they take it from there.
        </EmptyNote>
      ) : (
        <View style={{ gap: space.sm }} accessibilityLabel="Organizations">
          {rows.map((org) => (
            <Card
              key={org.id}
              mode="outlined"
              style={{ borderRadius: radius.lg, opacity: org.archived_at ? 0.7 : 1 }}
            >
              <TouchableRipple
                testID={`platform-org-${org.slug}`}
                accessibilityRole="button"
                accessibilityLabel={`${org.name}${org.archived_at ? ', archived' : ''}`}
                borderless
                style={{ borderRadius: radius.lg }}
                onPress={() => {
                  haptics.selection();
                  router.push({ pathname: '/platform/organizations/[id]', params: { id: org.id } });
                }}
              >
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg }}
                >
                  <OrgAvatar org={org} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <View
                      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}
                    >
                      <Text variant="titleSmall" numberOfLines={1} style={{ flexShrink: 1 }}>
                        {org.name}
                      </Text>
                      {org.archived_at ? (
                        <Chip testID={`platform-org-archived-${org.slug}`} compact mode="outlined">
                          Archived
                        </Chip>
                      ) : null}
                    </View>
                    <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                      {orgSummary(org)}
                    </Text>
                  </View>
                  <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
                </View>
              </TouchableRipple>
            </Card>
          ))}
        </View>
      )}

      {user ? (
        <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground, textAlign: 'center' }}>
          Signed in as {user.email ?? user.full_name}
        </Text>
      ) : null}
    </Screen>
  );
}
