// Ported from apps/web/src/features/locations/locations-page.tsx (Phase 33).
//
// Every tutor's and student's locations in one place, for the organization's admins. Each still
// belongs to its person: this is the same list as on their records, gathered by owner.
import type { Location } from '@tmi/shared';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';

import { PageIntro } from '@/components/page-intro';
import { Screen } from '@/components/screen';
import { Panel } from '@/components/section';
import { ErrorState } from '@/components/state-views';
import { DetailSkeleton } from '@/components/skeletons';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useOrganizationLocations } from './api';
import { LocationRow } from './locations-list';

export function OrganizationLocationsScreen() {
  const { user } = useAuth();
  const theme = useAppTheme();
  const isAdmin = Boolean(user?.roles.includes('admin'));
  const list = useOrganizationLocations(isAdmin);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const byOwner = new Map<string, { id: string; name: string; locations: Location[] }>();
    const needle = search.trim().toLowerCase();
    for (const location of list.data?.data ?? []) {
      if (needle && !`${location.owner_name} ${location.name}`.toLowerCase().includes(needle)) continue;
      const group = byOwner.get(location.owner_user_id) ?? {
        id: location.owner_user_id,
        name: location.owner_name,
        locations: [],
      };
      group.locations.push(location);
      byOwner.set(location.owner_user_id, group);
    }
    return [...byOwner.values()];
  }, [list.data, search]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await list.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  if (!isAdmin) {
    return (
      <Screen testID="screen-locations">
        <Stack.Screen options={{ title: 'Locations' }} />
        <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
          Only an administrator can see every location. Your own are on your profile.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen testID="screen-locations" refreshing={refreshing} onRefresh={() => void onRefresh()}>
      <Stack.Screen options={{ title: 'Locations' }} />
      <View style={{ gap: space.lg }}>
        <PageIntro>
          Where each tutor and student has lessons. A pairing allows some of its two people’s places, and each
          schedule picks from those.
        </PageIntro>
        <View style={{ flexDirection: 'row' }}>
          <Button
            testID="org-locations-add"
            mode="contained"
            icon="plus"
            onPress={() => router.push({ pathname: '/location-form' })}
          >
            Add a location
          </Button>
        </View>
        <TextInput
          testID="org-locations-search"
          mode="outlined"
          label="Search by person or place"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          left={<TextInput.Icon icon="magnify" />}
        />
        {list.isPending ? (
          <DetailSkeleton label="Loading the locations…" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => void list.refetch()} />
        ) : groups.length === 0 ? (
          <Text variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
            {search.trim()
              ? 'No location matches that search.'
              : 'No locations yet. Add one here, or from a tutor’s or student’s record.'}
          </Text>
        ) : (
          <View testID="organization-locations" style={{ gap: space.md }}>
            {groups.map((group) => (
              <Panel key={group.id} title={group.name} testID={`org-locations-${group.id}`}>
                <View style={{ gap: space.sm }}>
                  {group.locations.map((location) => (
                    <LocationRow key={location.id} location={location} />
                  ))}
                </View>
              </Panel>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
