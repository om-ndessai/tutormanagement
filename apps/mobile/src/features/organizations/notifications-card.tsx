// Ported from apps/web/src/features/organizations/{organization-settings-page.tsx
// (EmailNotificationsCard), notifications-switch.tsx} @ 1132322. The web's role="switch" button is
// Paper's Switch, which is announced and toggled as one.
import { NOTIFICATION_KIND_LABELS, formatRelativeTime, type NotificationLogEntry } from '@tmi/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Switch, Text } from 'react-native-paper';

import { Panel } from '@/components/section';
import { useToast } from '@/components/toast';
import { ApiRequestError } from '@/lib/api-client';
import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useOrganizationNotifications, useUpdateOrganizationSettings } from './api';

export const STATUS_LABELS: Record<NotificationLogEntry['status'], string> = {
  sent: 'Sent',
  failed: 'Not delivered',
  skipped: 'Not sent here',
};

/**
 * Phase 32: the organization's email notifications -- the switch, what it does, and who was emailed
 * lately. Names and outcomes only: the log holds no addresses and no message text.
 */
export function EmailNotificationsCard({ enabled }: { enabled: boolean }) {
  const theme = useAppTheme();
  const toast = useToast();
  const update = useUpdateOrganizationSettings();
  const log = useOrganizationNotifications(true);
  const entries = log.data?.data ?? [];
  const muted = theme.tokens.mutedForeground;
  // The switch moves at once; it settles on the server's answer, or back if it was refused.
  const [wanted, setWanted] = useState<boolean | null>(null);
  const shown = wanted ?? enabled;

  async function toggle(next: boolean) {
    haptics.selection();
    setWanted(next);
    try {
      await update.mutateAsync({ email_notifications: next });
      toast.success(next ? 'Email notifications are on.' : 'Email notifications are off.');
    } catch (caught) {
      haptics.error();
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change notifications.');
    } finally {
      setWanted(null);
    }
  }

  return (
    <Panel title="Email notifications" testID="org-notifications">
      <View style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
          <Text variant="bodySmall" style={{ flex: 1, color: muted }}>
            When on, the people concerned are emailed when someone is added, a plan or assessment is added,
            lessons are scheduled, or a session is recorded. An email says what happened and links here —
            never money, notes or scores. On Cloudflare’s free plan only verified addresses receive mail; the
            others show as not delivered below.
          </Text>
          <Switch
            testID="org-notifications-switch"
            value={shown}
            disabled={update.isPending}
            onValueChange={(next) => void toggle(next)}
            accessibilityLabel="Email notifications"
            accessibilityRole="switch"
            accessibilityState={{ checked: shown, disabled: update.isPending }}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Text variant="labelLarge">Recent emails</Text>
          {entries.length === 0 ? (
            <Text testID="org-notifications-empty" variant="bodySmall" style={{ color: muted }}>
              Nothing sent yet.
            </Text>
          ) : (
            <View accessibilityLabel="Recent emails" style={{ gap: space.sm }}>
              {entries.slice(0, 12).map((entry) => (
                <NotificationRow key={entry.id} entry={entry} />
              ))}
            </View>
          )}
        </View>
      </View>
    </Panel>
  );
}

function NotificationRow({ entry }: { entry: NotificationLogEntry }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const failed = entry.status === 'failed';
  const about =
    entry.subject_name && entry.subject_name !== entry.recipient_name ? ` · ${entry.subject_name}` : '';

  return (
    <View
      testID={`org-notification-${entry.id}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyMedium" style={{ fontWeight: '700' }}>
          {entry.recipient_name}
        </Text>
        <Text variant="bodySmall" style={{ color: muted }}>
          {`${NOTIFICATION_KIND_LABELS[entry.kind]}${about} · ${formatRelativeTime(entry.created_at)}`}
        </Text>
      </View>
      <View
        style={{
          paddingHorizontal: space.sm,
          paddingVertical: 2,
          borderRadius: radius.sm,
          backgroundColor: failed ? withAlpha(theme.tokens.destructive, 0.12) : theme.tokens.muted,
        }}
      >
        <Text variant="labelSmall" style={{ color: failed ? theme.tokens.destructive : muted }}>
          {STATUS_LABELS[entry.status]}
        </Text>
      </View>
    </View>
  );
}
