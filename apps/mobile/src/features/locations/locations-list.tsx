// Ported from apps/web/src/features/locations/locations-list.tsx @ 2933e3f (Phase 33, working tree).
// The web's dialog becomes the `(org)/location-form` sheet: `?owner=` to add, `&id=` to edit.
import { LOCATION_KIND_LABELS, type Location } from '@tmi/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { IconButton } from '@/components/icon-button';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useDeleteLocation, useLocations } from './api';

/** A tutor's or a student's own locations, with add, edit and remove (Phase 33). */
export function LocationsList({ ownerId }: { ownerId: string }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const toast = useToast();
  const { data, isPending } = useLocations(ownerId);
  const remove = useDeleteLocation();
  const locations = data?.data ?? [];

  async function removeLocation(location: Location) {
    try {
      await remove.mutateAsync(location.id);
      toast.success(`Removed ${location.name}.`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove the location.');
    }
  }

  return (
    <View testID="locations-list" style={{ gap: space.sm }}>
      {isPending ? null : locations.length === 0 ? (
        <Text variant="bodyMedium" style={{ color: muted }}>
          No locations yet.
        </Text>
      ) : (
        locations.map((location) => (
          <View
            key={location.id}
            testID={`location-${location.id}`}
            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}
          >
            <View style={{ paddingTop: 12 }}>
              <Icon
                source={location.kind === 'virtual' ? 'web' : 'map-marker-outline'}
                size={16}
                color={muted}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2, paddingTop: 10 }}>
              <Text variant="bodyMedium" style={{ fontWeight: '600' }}>
                {location.name}
                <Text variant="bodySmall" style={{ color: muted, fontWeight: 'normal' }}>
                  {'  '}
                  {LOCATION_KIND_LABELS[location.kind]}
                </Text>
              </Text>
              {location.address ? (
                <Text variant="bodySmall" style={{ color: muted }}>
                  {location.address}
                </Text>
              ) : null}
              {location.reminder_minutes > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon source="bell-outline" size={12} color={muted} />
                  <Text variant="bodySmall" style={{ color: muted }}>
                    Reminder {location.reminder_minutes} min before
                  </Text>
                </View>
              ) : null}
            </View>
            <IconButton
              testID={`location-edit-${location.id}`}
              icon="pencil-outline"
              accessibilityLabel={`Edit ${location.name}`}
              style={{ margin: 0 }}
              onPress={() =>
                router.push({ pathname: '/location-form', params: { owner: ownerId, id: location.id } })
              }
            />
            <IconButton
              testID={`location-remove-${location.id}`}
              icon="trash-can-outline"
              accessibilityLabel={`Remove ${location.name}`}
              disabled={remove.isPending}
              style={{ margin: 0 }}
              onPress={() => void removeLocation(location)}
            />
          </View>
        ))
      )}
      <View style={{ flexDirection: 'row' }}>
        <Button
          testID="locations-add"
          mode="outlined"
          icon="plus"
          compact
          onPress={() => router.push({ pathname: '/location-form', params: { owner: ownerId } })}
        >
          Add a location
        </Button>
      </View>
    </View>
  );
}
