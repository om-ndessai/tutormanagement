// Ported from apps/web/src/features/audit/activity-feed.tsx @ 1132322
import { AUDIT_ACTION_LABELS, formatRelativeTime, type AuditEvent } from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { Skeleton } from '@/components/skeleton';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import { space } from '@/theme/tokens';

/**
 * A glyph per action, so a long feed can be scanned by shape before it is read. Falls back to a
 * generic marker rather than breaking on an action added later.
 */
const ACTION_ICONS: Record<string, string> = {
  'auth.signed_in': 'login',
  'auth.signed_out': 'logout',
  'auth.denied': 'shield-alert-outline',
  'user.created': 'account-plus-outline',
  'user.updated': 'pencil-outline',
  'user.roles_changed': 'key-outline',
  'user.deactivated': 'account-off-outline',
  'user.restored': 'restore',
  'user.deleted': 'trash-can-outline',
};

/** Actions worth noticing at a glance get a colour; routine ones stay neutral. */
function actionTone(theme: AppTheme, action: string): { background: string; color: string } {
  const t = theme.tokens;
  const dark = theme.scheme === 'dark';
  switch (action) {
    case 'auth.denied':
    case 'user.deleted':
      return { background: withAlpha(t.destructive, 0.1), color: t.destructive };
    case 'user.deactivated':
      return { background: withAlpha(t.warning, 0.15), color: dark ? t.warning : t.warningForeground };
    case 'user.roles_changed':
      return {
        background: dark ? withAlpha(t.brand900, 0.6) : t.brand100,
        color: dark ? t.brand200 : t.brand800,
      };
    case 'user.created':
      return { background: withAlpha(t.success, 0.15), color: t.success };
    default:
      return { background: t.muted, color: t.mutedForeground };
  }
}

export function ActivityFeed({
  events,
  isLoading,
  emptyMessage = 'No activity recorded yet.',
  /** Hide the actor when the feed is already filtered to one person. */
  showActor = true,
}: {
  events: AuditEvent[];
  isLoading?: boolean;
  emptyMessage?: string;
  showActor?: boolean;
}) {
  const theme = useAppTheme();

  if (isLoading) {
    return (
      <View style={{ gap: space.lg, paddingVertical: space.sm }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={{ flexDirection: 'row', gap: space.md }}>
            <Skeleton width={32} height={32} style={{ borderRadius: 16 }} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="66%" height={16} />
              <Skeleton width={96} height={12} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <Text
        testID="activity-empty"
        variant="bodyMedium"
        style={{ color: theme.tokens.mutedForeground, textAlign: 'center', paddingVertical: space.xl }}
      >
        {emptyMessage}
      </Text>
    );
  }

  return (
    <View>
      {events.map((event, index) => {
        const tone = actionTone(theme, event.action);
        const last = index === events.length - 1;
        return (
          <View
            key={event.id}
            testID={`activity-${event.id}`}
            style={{ flexDirection: 'row', gap: space.md }}
          >
            {/* The timeline: a dot per event, joined by a hairline. */}
            <View style={{ alignItems: 'center' }}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  marginTop: space.sm,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: tone.background,
                }}
              >
                <Icon source={ACTION_ICONS[event.action] ?? 'pulse'} size={16} color={tone.color} />
              </View>
              {!last ? (
                <View style={{ flex: 1, width: 1, backgroundColor: theme.colors.outlineVariant }} />
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingVertical: space.sm + 2 }}>
              <Text variant="bodyMedium">{event.description}</Text>
              <Text variant="bodySmall" style={{ marginTop: 2, color: theme.tokens.mutedForeground }}>
                {showActor ? (
                  <Text style={{ fontWeight: '500', color: theme.tokens.mutedForeground }}>
                    {event.actor_name}
                  </Text>
                ) : null}
                {showActor ? ' · ' : ''}
                {AUDIT_ACTION_LABELS[event.action as never] ?? event.action}
                {' · '}
                {formatRelativeTime(event.created_at)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
