// Ported from apps/web/src/features/teaching/session-form-dialog.tsx @ 1132322 (PreviousLesson).
import type { TutoringSession } from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';

/**
 * The last lesson with this student, as a reminder of what is being reviewed: the homework that
 * was set, and what was covered. Read-only, and never money.
 */
export function PreviousLesson({ session, showTutor }: { session: TutoringSession; showTutor: boolean }) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const homework = session.write_up?.homework_assigned;
  return (
    <View
      testID="record-previous"
      style={{
        backgroundColor: theme.tokens.muted,
        borderRadius: radius.md,
        paddingHorizontal: space.md,
        paddingVertical: 10,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon source="history" size={14} color={muted} />
        <Text variant="bodySmall" style={{ color: muted, fontWeight: '600', flexShrink: 1 }}>
          Last lesson, {session.occurred_on}
          {showTutor ? ` with ${session.tutor_name}` : ''}
        </Text>
      </View>
      {homework ? (
        <Text variant="bodySmall">
          <Text variant="bodySmall" style={{ fontWeight: '600' }}>
            Homework set:
          </Text>{' '}
          {homework}
        </Text>
      ) : (
        <Text variant="bodySmall" style={{ color: muted }}>
          No homework was recorded.
        </Text>
      )}
      {session.notes ? (
        <Text variant="bodySmall" numberOfLines={2} style={{ color: muted }}>
          {session.notes}
        </Text>
      ) : null}
    </View>
  );
}
