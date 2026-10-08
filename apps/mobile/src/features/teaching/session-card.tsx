// Ported from apps/web/src/features/teaching/sessions-page.tsx @ 1132322 (one lesson's card). The
// web expands a card in place; on the phone the card opens the lesson's detail. The card carries
// no money of its own: the Finance tab passes `SessionMoney` in as `money`.
import { SESSION_MODE_LABELS, formatDuration, type TutoringSession } from '@tmi/shared';
import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Divider, Icon, Text } from 'react-native-paper';

import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { ReflectionFlags } from './reflection-chips';
import { formatSessionDay, formatSessionTimes } from './session-format';
import { AssessmentChips, HomeworkStatusBadge } from './session-notes';

export function Tag({ label, tone, testID }: { label: string; tone?: 'warning'; testID?: string }) {
  const theme = useAppTheme();
  const warningInk = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;
  return (
    <View
      testID={testID}
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

/** A line of the write-up to recognise the lesson by: what was covered, else what was planned. */
export function writeUpPreview(session: Pick<TutoringSession, 'notes' | 'write_up'>): string | null {
  return session.notes ?? session.write_up?.planned ?? session.write_up?.homework_assigned ?? null;
}

/** The sentence an auto-stopped lesson carries wherever it is shown. */
export const AUTO_STOPPED_NOTE =
  'The timer ran past the session limit, so this was recorded at it. Edit it if the lesson was a different length.';

export const SessionCard = memo(function SessionCard({
  session,
  today,
  onPress,
  money,
}: {
  session: TutoringSession;
  /** Today on the organization's clock, to leave this year off the date. */
  today: string;
  onPress: (session: TutoringSession) => void;
  /** The Finance tab's `SessionMoney`; nothing on Tutoring. */
  money?: ReactNode;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const day = formatSessionDay(session.occurred_on, today);
  const preview = writeUpPreview(session);
  const homework = session.write_up?.homework_status;
  const hasFooter = Boolean(homework || session.assessments.length > 0 || session.reflection);

  return (
    // The whole card opens the lesson, but it is not one accessible element: a screen reader (and
    // a test) still reads each line, and the chevron is the labelled button.
    <Pressable
      testID={`session-card-${session.id}`}
      accessible={false}
      onPress={() => onPress(session)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
        <View style={{ padding: space.lg, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <Text variant="bodyLarge" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
              <Text style={{ fontWeight: '600' }}>{session.student_name}</Text>
              <Text style={{ color: muted }}> with {session.tutor_name}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open the lesson: ${session.student_name} with ${session.tutor_name}, ${day}`}
              hitSlop={12}
              onPress={() => onPress(session)}
            >
              <Icon source="chevron-right" size={20} color={muted} />
            </Pressable>
          </View>
          <Text variant="bodySmall" style={{ color: muted }}>
            {day} · {formatSessionTimes(session.started_at, session.ended_at)} ·{' '}
            {formatDuration(session.duration_minutes)}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            <Tag label={SESSION_MODE_LABELS[session.mode]} />
            {session.auto_stopped ? <Tag label="Auto-stopped" tone="warning" /> : null}
          </View>
          {/* The end was imposed by the limit, not watched: the figure most worth checking. */}
          {session.auto_stopped ? (
            <Text variant="bodySmall" style={{ color: muted }}>
              {AUTO_STOPPED_NOTE}
            </Text>
          ) : null}
          {preview ? (
            <Text testID={`session-preview-${session.id}`} variant="bodyMedium" numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
          {hasFooter ? (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              {homework ? <HomeworkStatusBadge status={homework} /> : null}
              <AssessmentChips assessments={session.assessments} />
              {session.reflection ? (
                <>
                  <Tag label="Student reflected" testID={`session-reflected-${session.id}`} />
                  <ReflectionFlags reflection={session.reflection} />
                </>
              ) : null}
            </View>
          ) : null}
        </View>
        {/* A View, not a fragment: Paper's Card hands each child an `index` prop. */}
        {money ? (
          <View>
            <Divider />
            <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'flex-end' }}>
              {money}
            </View>
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
});
