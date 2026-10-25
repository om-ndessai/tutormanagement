// Ported from apps/web/src/features/users/join-requests-panel.tsx @ 9485a8e
//
// Phase 52: people who asked to join with the space's code, at the head of the People list. Letting
// someone in opens the person form, prefilled from the request (`/person-form?request=<id>`), to
// choose their roles -- the usual rules apply. Its admins only (R21); nothing when there are none.
import { formatRelativeTime, type JoinRequest } from '@tmi/shared';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useToast } from '@/components/toast';
import { useDeclineJoinRequest, useJoinRequests } from '@/features/organizations/api';
import { showProblem } from '@/lib/api-errors';
import { haptics } from '@/lib/haptics';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

export function JoinRequestsSection({ enabled }: { enabled: boolean }) {
  const theme = useAppTheme();
  const brand = useBrand();
  const toast = useToast();
  const requests = useJoinRequests(enabled);
  const decline = useDeclineJoinRequest();
  const rows = requests.data?.data ?? [];
  if (!enabled || rows.length === 0) return null;

  function confirmDecline(request: JoinRequest) {
    // A mis-tap on a phone is easy, and the person is told: ask first (the web acts on the click).
    haptics.warning();
    Alert.alert(`Decline ${request.full_name}’s request?`, `They will see that ${brand.name} didn’t accept.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Decline request',
        style: 'destructive',
        onPress: () =>
          decline.mutate(request.user_id, {
            onSuccess: () => toast.success(`${request.full_name}’s request declined.`),
            onError: (caught) => showProblem(toast, caught, 'Could not decline the request.'),
          }),
      },
    ]);
  }

  return (
    <View testID="join-requests" accessibilityLabel="Requests to join" style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text
          variant="labelLarge"
          accessibilityRole="header"
          style={{ color: theme.tokens.mutedForeground, fontWeight: '600' }}
        >
          Requests to join
        </Text>
        <View
          testID="join-requests-count"
          accessibilityLabel={`${rows.length} waiting`}
          style={{
            backgroundColor: theme.colors.primary,
            borderRadius: radius.pill,
            minWidth: 22,
            paddingHorizontal: space.sm,
            paddingVertical: 1,
            alignItems: 'center',
          }}
        >
          <Text variant="labelSmall" style={{ color: theme.colors.onPrimary, fontWeight: '700' }}>
            {String(rows.length)}
          </Text>
        </View>
      </View>
      {rows.map((request) => (
        <OutlinedCard key={request.user_id} testID={`join-request-${request.user_id}`}>
          <Card.Content style={{ gap: space.sm, paddingVertical: space.md }}>
            <View style={{ gap: 2 }}>
              <Text variant="titleSmall" numberOfLines={1}>
                {request.full_name}
              </Text>
              <Text variant="bodySmall" numberOfLines={2} style={{ color: theme.tokens.mutedForeground }}>
                {`${request.email ?? 'No email'} · asked ${formatRelativeTime(request.requested_at)}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Button
                testID={`join-request-let-in-${request.user_id}`}
                mode="contained"
                compact
                onPress={() =>
                  router.push({ pathname: '/person-form', params: { request: request.user_id } })
                }
              >
                Let in
              </Button>
              <Button
                testID={`join-request-decline-${request.user_id}`}
                mode="text"
                compact
                disabled={decline.isPending}
                onPress={() => confirmDecline(request)}
              >
                Decline
              </Button>
            </View>
          </Card.Content>
        </OutlinedCard>
      ))}
    </View>
  );
}
