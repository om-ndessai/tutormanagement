// Ported from apps/web/src/features/schedules/schedules-page.tsx @ 1132322 (one slot's card).
// Everyone who can see a schedule can download it; only its tutor (or an admin) can change it.
// Expanding the card lists its coming dates. No money: a schedule carries none.
import {
  SESSION_MODE_LABELS,
  describeLocation,
  describeSchedule,
  zonedClockParts,
  type VisibleSchedule,
} from '@tmi/shared';
import { View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';

import { formatPlainDay } from '@/features/teaching/session-format';
import { useOrgTimeZone } from '@/providers/auth-provider';
import { IconButton } from '@/components/icon-button';
import { CommentsButton } from '@/features/comments/comments-button';
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
  const timeZone = useOrgTimeZone();
  const today = zonedClockParts(new Date().toISOString(), timeZone).day;

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
            from {formatPlainDay(schedule.starts_on, today)}
            {schedule.ends_on ? ` to ${formatPlainDay(schedule.ends_on, today)}` : ', ongoing'}
          </Text>
          {schedule.locations.length > 0 ? (
            <Text testID={`schedule-locations-${schedule.id}`} variant="bodySmall" style={{ color: muted }}>
              {schedule.locations.map((place) => describeLocation(place)).join(' · ')}
            </Text>
          ) : null}
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
          <CommentsButton
            testID={`schedule-comments-${schedule.id}`}
            target={{ target_type: 'scheduled_session', target_id: schedule.id }}
            title={`${schedule.student_name}’s recurring session`}
            description={`${described}, with ${schedule.tutor_name}.`}
          />
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
