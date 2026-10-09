// Ported from apps/web/src/features/schedules/schedules-page.tsx @ 1132322 (one slot's card).
// Everyone who can see a schedule can download it; only its tutor (or an admin) can change it.
// Expanding the card lists its coming dates. No money: a schedule carries none.
import { SESSION_MODE_LABELS, describeSchedule, type VisibleSchedule } from '@tmi/shared';
import { View } from 'react-native';
import { Button, Card, IconButton, Text } from 'react-native-paper';

import { Tag } from '@/features/teaching/session-card';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { ScheduleDates } from './schedule-dates';

export function ScheduleCard({
  schedule,
  canEdit,
  datesOpen,
  highlight,
  downloading,
  onToggleDates,
  onCalendar,
  onEdit,
  onRemove,
}: {
  schedule: VisibleSchedule;
  canEdit: boolean;
  datesOpen: boolean;
  highlight: string | null;
  downloading: boolean;
  onToggleDates: () => void;
  onCalendar: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const described = describeSchedule(schedule);

  return (
    <Card testID={`schedule-card-${schedule.id}`} mode="outlined" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.md, paddingLeft: space.lg, gap: space.sm }}>
        <View style={{ gap: 2 }}>
          <Text variant="titleMedium">
            {schedule.student_name}
            <Text variant="bodyMedium" style={{ color: muted }}>
              {' '}
              with {schedule.tutor_name}
            </Text>
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
            <Text variant="bodySmall" style={{ color: muted }}>
              {described}
            </Text>
            <Tag label={SESSION_MODE_LABELS[schedule.mode]} />
          </View>
          <Text variant="bodySmall" style={{ color: muted }}>
            from {schedule.starts_on}
            {schedule.ends_on ? ` to ${schedule.ends_on}` : ', ongoing'}
          </Text>
          {schedule.location ? (
            <Text variant="bodySmall" style={{ color: muted }} numberOfLines={1}>
              {schedule.location}
            </Text>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Button
            testID={`schedule-dates-toggle-${schedule.id}`}
            mode={datesOpen ? 'contained-tonal' : 'text'}
            compact
            icon="calendar-month-outline"
            accessibilityState={{ expanded: datesOpen }}
            onPress={onToggleDates}
          >
            Dates
          </Button>
          <View style={{ flex: 1 }} />
          {/* The schedule's comments (#29) go here. */}
          <IconButton
            testID={`schedule-calendar-${schedule.id}`}
            icon="calendar-export"
            accessibilityLabel={`Add ${schedule.student_name}'s lessons to your calendar`}
            onPress={onCalendar}
            disabled={downloading}
            style={{ margin: 0 }}
          />
          {canEdit ? (
            <>
              <IconButton
                testID={`schedule-edit-${schedule.id}`}
                icon="pencil-outline"
                accessibilityLabel={`Edit ${schedule.student_name}'s ${described} schedule`}
                onPress={onEdit}
                style={{ margin: 0 }}
              />
              <IconButton
                testID={`schedule-remove-${schedule.id}`}
                icon="trash-can-outline"
                accessibilityLabel={`Remove ${schedule.student_name}'s ${described} schedule`}
                onPress={onRemove}
                style={{ margin: 0 }}
              />
            </>
          ) : null}
        </View>

        {datesOpen ? <ScheduleDates schedule={schedule} highlight={highlight} /> : null}
      </View>
    </Card>
  );
}
