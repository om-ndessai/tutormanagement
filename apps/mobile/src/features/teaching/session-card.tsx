// Ported from apps/web/src/features/teaching/sessions-page.tsx @ 1132322 (one lesson's card). The
// web expands a card in place; on the phone the card opens the lesson's detail. The card carries
// no money of its own: the Finance tab passes `SessionMoney` in as `money`.
import {
  HOMEWORK_STATUS_LABELS,
  SESSION_MODE_LABELS,
  formatDuration,
  type TutoringSession,
} from '@tmi/shared';
import { memo, type ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import { Card, Divider, Icon, Text } from 'react-native-paper';

import { rowActionsA11y, type RowAction } from '@/components/swipe-row';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { ReflectionFlags } from './reflection-chips';
import { AssessButton, ReflectButton, assessLabel, reflectLabel } from './session-actions';
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

/**
 * What a screen reader says for the card, which is one accessible element (ux-audit F-20): who,
 * when, how long, how, the line of the write-up and the flags. Never money — the Finance tab's
 * figure sits beside the card's content, as its own element.
 */
export function sessionCardLabel(session: TutoringSession, day: string): string {
  const parts = [
    `Lesson with ${session.student_name}, with ${session.tutor_name}`,
    day,
    formatSessionTimes(session.started_at, session.ended_at),
    formatDuration(session.duration_minutes),
    SESSION_MODE_LABELS[session.mode],
  ];
  if (session.auto_stopped) parts.push('Auto-stopped');
  const preview = writeUpPreview(session);
  if (preview) parts.push(preview);
  const homework = session.write_up?.homework_status;
  if (homework) parts.push(`Homework: ${HOMEWORK_STATUS_LABELS[homework].toLowerCase()}`);
  if (session.assessments.length > 0) {
    parts.push(
      session.assessments.length === 1 ? '1 assessment' : `${session.assessments.length} assessments`,
    );
  }
  if (session.reflection) parts.push('Student reflected');
  return parts.join(', ');
}

export const SessionCard = memo(function SessionCard({
  session,
  today,
  onPress,
  money,
  actions = [],
  onLongPress,
}: {
  session: TutoringSession;
  /** Today on the organization's clock, to leave this year off the date. */
  today: string;
  onPress: (session: TutoringSession) => void;
  /** The Finance tab's `SessionMoney`; nothing on Tutoring. */
  money?: ReactNode;
  /** The row's verbs (Sessions list), offered to a screen reader as accessibility actions. */
  actions?: RowAction[];
  /** Opens the row's menu (from `SwipeRow`). */
  onLongPress?: (event: GestureResponderEvent) => void;
}) {
  const theme = useAppTheme();
  const { user } = useAuth();
  const muted = theme.tokens.mutedForeground;
  const day = formatSessionDay(session.occurred_on, today);
  const hasActions = Boolean(assessLabel(session, user) || reflectLabel(session, user));
  const preview = writeUpPreview(session);
  const homework = session.write_up?.homework_status;
  const hasFooter = Boolean(homework || session.assessments.length > 0 || session.reflection);
  const a11y = rowActionsA11y(actions, () => onPress(session));

  return (
    <Card mode="outlined" style={{ borderRadius: radius.lg }} contentStyle={{ padding: 0 }}>
      {/* The lesson itself is one labelled button that opens it (F-20); its verbs are accessibility
          actions. The Assess/Reflect row and the money sit beside it, as their own elements. */}
      <Pressable
        testID={`session-card-${session.id}`}
        accessibilityRole="button"
        accessibilityLabel={sessionCardLabel(session, day)}
        accessibilityHint="Opens the lesson"
        {...a11y}
        onPress={() => onPress(session)}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ padding: space.lg, paddingBottom: hasActions ? space.sm : space.lg, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <Text variant="bodyLarge" style={{ flex: 1, minWidth: 0 }} numberOfLines={2}>
              <Text style={{ fontWeight: '600' }}>{session.student_name}</Text>
              <Text style={{ color: muted }}> with {session.tutor_name}</Text>
            </Text>
            <Icon source="chevron-right" size={20} color={muted} />
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
      </Pressable>
      {/* The web's expanded card offers these too; pressing one does not open the lesson. */}
      {hasActions ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            paddingHorizontal: space.sm,
            paddingBottom: space.sm,
          }}
        >
          <AssessButton session={session} testID={`session-assess-${session.id}`} compact />
          <ReflectButton session={session} testID={`session-reflect-${session.id}`} compact />
        </View>
      ) : null}
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
  );
});
