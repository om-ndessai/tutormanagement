// Ported from apps/web/src/features/dashboard/role-dashboards.tsx @ 1132322 (SessionList)
import { SESSION_MODE_LABELS, formatDuration, type TutoringSession } from '@tmi/shared';
import { View } from 'react-native';
import { Divider, Text } from 'react-native-paper';

import { EmptyNote } from '@/components/section';
import { SessionMoney } from '@/features/teaching/session-money';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';

function Tag({ label, tone }: { label: string; tone?: 'warning' }) {
  const theme = useAppTheme();
  const warningInk = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;
  return (
    <View
      style={{
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderWidth: 1,
        borderColor: tone ? withAlpha(theme.tokens.warning, 0.6) : 'transparent',
        backgroundColor: tone ? 'transparent' : theme.tokens.muted,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '500', color: tone ? warningInk : theme.colors.onSurface }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Sessions newest-first, which is how every role wants to read them. Money, when shown, is
 * `SessionMoney`'s, from the reader's side; `hideMoney` leaves it out altogether.
 */
export function SessionList({
  sessions,
  showTutor,
  hideMoney,
}: {
  sessions: TutoringSession[];
  showTutor?: boolean;
  hideMoney?: boolean;
}) {
  const theme = useAppTheme();
  if (sessions.length === 0) return <EmptyNote>No sessions recorded yet.</EmptyNote>;

  return (
    <View>
      {sessions.map((session, index) => (
        <View key={session.id}>
          {index > 0 ? <Divider /> : null}
          <View
            testID={`session-row-${session.id}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 }}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <Text variant="bodyMedium" numberOfLines={1}>
                <Text style={{ fontWeight: '500' }}>{session.student_name}</Text>
                {showTutor ? (
                  <Text style={{ color: theme.tokens.mutedForeground }}> with {session.tutor_name}</Text>
                ) : null}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
                  {session.occurred_on} · {formatDuration(session.duration_minutes)}
                </Text>
                <Tag label={SESSION_MODE_LABELS[session.mode]} />
                {session.auto_stopped ? <Tag label="Auto-stopped" tone="warning" /> : null}
              </View>
            </View>
            {hideMoney ? null : <SessionMoney session={session} compact />}
          </View>
        </View>
      ))}
    </View>
  );
}
