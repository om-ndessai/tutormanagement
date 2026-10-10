// Ported from apps/web/src/features/platform/{organizations-page,organization-dialog}.tsx @ 1132322.
// One organization as the console sees it: its identity and look, its logos, its admins, and
// archiving. On the web this is the edit dialog plus the list row's archive button; on the phone it
// is a screen, with the identity form as a sheet over it.
import { ORG_PALETTE_LABELS, ORG_TIME_ZONE_LABELS } from '@tmi/shared';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';

import { Screen } from '@/components/screen';
import { ErrorState, LoadingState } from '@/components/state-views';
import { useToast } from '@/components/toast';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { AdminsSection } from './admins-section';
import { useArchiveOrganization, useOrganizations } from './api';
import { LogoSection } from './logo-section';

export function OrganizationDetailScreen({ id }: { id: string }) {
  const theme = useAppTheme();
  const toast = useToast();
  const organizations = useOrganizations();
  const archive = useArchiveOrganization();
  const [refreshing, setRefreshing] = useState(false);
  const org = organizations.data?.data.find((row) => row.id === id) ?? null;

  async function onRefresh() {
    setRefreshing(true);
    try {
      await organizations.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  if (organizations.isPending) {
    return (
      <Screen testID="screen-platform-organization">
        <Stack.Screen options={{ title: 'Organization' }} />
        <LoadingState />
      </Screen>
    );
  }
  if (organizations.isError || !org) {
    return (
      <Screen testID="screen-platform-organization">
        <Stack.Screen options={{ title: 'Organization' }} />
        <ErrorState
          error={organizations.error ?? new ApiRequestError(404, 'not_found', 'Not found.')}
          onRetry={() => void organizations.refetch()}
        />
      </Screen>
    );
  }

  const archived = Boolean(org.archived_at);

  function confirmArchive() {
    if (!org) return;
    haptics.warning();
    const name = org.name;
    Alert.alert(
      archived ? `Restore ${name}?` : `Archive ${name}?`,
      archived
        ? 'Its members can enter it again.'
        : 'Nobody can enter it until it is restored. Its records are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: archived ? 'Restore' : 'Archive',
          style: archived ? 'default' : 'destructive',
          onPress: () =>
            archive.mutate(
              { id: org.id, archived: !archived },
              {
                onSuccess: () => {
                  haptics.success();
                  toast.success(archived ? `${name} restored.` : `${name} archived: nobody can enter it.`);
                },
                onError: (error) => {
                  haptics.error();
                  toast.error(
                    error instanceof ApiRequestError ? error.message : 'That did not work. Try again.',
                  );
                },
              },
            ),
        },
      ],
    );
  }

  return (
    <Screen testID="screen-platform-organization" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: org.short_name }} />
      <Card mode="outlined" style={{ borderRadius: radius.lg }}>
        <View style={{ padding: space.lg, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <OrgAvatar org={org} size={56} />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text variant="titleMedium" accessibilityRole="header">
                {org.name}
              </Text>
              {org.tagline ? (
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  {org.tagline}
                </Text>
              ) : null}
            </View>
            {archived ? (
              <Chip testID="platform-org-archived" compact mode="outlined">
                Archived
              </Chip>
            ) : null}
          </View>
          <Fact label="Address name" value={org.slug} />
          <Fact label="Palette" value={ORG_PALETTE_LABELS[org.palette]} />
          <Fact label="Lessons are recorded on" value={`${ORG_TIME_ZONE_LABELS[org.time_zone]} time`} />
          <Fact label="Email notifications" value={org.email_notifications ? 'On' : 'Off'} />
          <Fact
            label="People"
            value={`${org.admin_count} ${org.admin_count === 1 ? 'admin' : 'admins'} · ${org.member_count} ${
              org.member_count === 1 ? 'member' : 'members'
            }`}
          />
          <Button
            testID="platform-org-edit"
            mode="contained-tonal"
            icon="pencil-outline"
            onPress={() => {
              haptics.selection();
              router.push({ pathname: '/organization-form', params: { id: org.id } });
            }}
            style={{ alignSelf: 'flex-start' }}
          >
            Edit details
          </Button>
        </View>
      </Card>

      <LogoSection organization={org} />
      <AdminsSection organization={org} />

      <Button
        testID={archived ? 'platform-org-restore' : 'platform-org-archive'}
        mode="outlined"
        icon={archived ? 'archive-arrow-up-outline' : 'archive-outline'}
        textColor={archived ? theme.colors.primary : theme.colors.error}
        disabled={archive.isPending}
        onPress={confirmArchive}
      >
        {archived ? 'Restore organization' : 'Archive organization'}
      </Button>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View>
      <Text variant="labelSmall" style={{ color: theme.tokens.mutedForeground }}>
        {label}
      </Text>
      <Text variant="bodyMedium">{value}</Text>
    </View>
  );
}
