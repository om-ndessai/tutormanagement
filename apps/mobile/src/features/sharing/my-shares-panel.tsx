// Ported from apps/web/src/features/sharing/my-shares-card.tsx @ 3279506
import { shareHeadline } from '@tmi/shared';
import { Linking, View } from 'react-native';
import { Button, Divider, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { formatInstant } from '@/features/users/people-model';
import { serverOrigin } from '@/lib/server';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { space } from '@/theme/tokens';
import { useMyShares, useWithdrawShare } from './api';
import { shareLinkAndText } from './share-model';

/**
 * Phase 56: the reader's own shares on the Quest screen -- each link (opened in the browser), and
 * Withdraw, after which it reads "no longer available". Hidden while there are none.
 */
export function MySharesPanel() {
  const theme = useAppTheme();
  const toast = useToast();
  const timeZone = useOrgTimeZone();
  const shares = useMyShares();
  const withdraw = useWithdrawShare();
  const live = (shares.data?.data ?? []).filter((share) => !share.withdrawn_at);
  if (live.length === 0) return null;
  return (
    <Panel title="Your shares" testID="my-shares">
      <View>
        {live.map((share, index) => (
          <View key={share.id}>
            {index > 0 ? <Divider /> : null}
            <View
              testID={`my-share-${share.id}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  variant="bodyMedium"
                  accessibilityRole="link"
                  style={{ fontWeight: '600', textDecorationLine: 'underline' }}
                  onPress={() =>
                    void Linking.openURL(shareLinkAndText(share, serverOrigin(), '').link).catch(() => undefined)
                  }
                >
                  {shareHeadline(share.card)}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  {`Shared ${formatInstant(share.created_at, timeZone, '')}`}
                </Text>
              </View>
              <Button
                testID={`my-share-withdraw-${share.id}`}
                mode="text"
                compact
                disabled={withdraw.isPending}
                contentStyle={{ minHeight: 44 }}
                onPress={() =>
                  void withdraw
                    .mutateAsync(share.id)
                    .then(() => toast.success('Withdrawn.'))
                    .catch(() => toast.error('Could not withdraw it.'))
                }
              >
                Withdraw
              </Button>
            </View>
          </View>
        ))}
      </View>
    </Panel>
  );
}
