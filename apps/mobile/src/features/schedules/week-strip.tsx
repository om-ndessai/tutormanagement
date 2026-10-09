// The week at a glance, above the schedule: one chip per weekday. A day with lessons narrows the
// list to that day (pressed again, the whole week comes back); a day without is shown, dimmed, so
// the week still reads as a week. Today's weekday (on the organization's clock) is ringed.
import { DAYS_OF_WEEK } from '@tmi/shared';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

export function WeekStrip({
  counts,
  todayWeekday,
  selected,
  onSelect,
}: {
  /** Lessons per weekday, 0 = Sunday. */
  counts: number[];
  todayWeekday: number;
  /** The day the list is narrowed to, or null for the whole week. */
  selected: number | null;
  onSelect: (day: number | null) => void;
}) {
  const theme = useAppTheme();

  return (
    <View
      testID="schedule-week-strip"
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        gap: space.xs,
        paddingVertical: space.sm,
        backgroundColor: theme.colors.background,
      }}
    >
      {DAYS_OF_WEEK.map((day) => {
        const count = counts[day.value] ?? 0;
        const isToday = day.value === todayWeekday;
        const enabled = count > 0;
        const chosen = selected === day.value;
        return (
          <Pressable
            key={day.value}
            testID={`schedule-day-${day.value}`}
            accessibilityRole="button"
            accessibilityLabel={`${day.label}: ${count === 0 ? 'no lessons' : count === 1 ? '1 lesson' : `${count} lessons`}${isToday ? ', today' : ''}`}
            accessibilityState={{ disabled: !enabled, selected: chosen }}
            disabled={!enabled}
            onPress={() => {
              haptics.selection();
              onSelect(chosen ? null : day.value);
            }}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: MIN_TARGET + 8,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: isToday ? 2 : 1,
              borderColor: isToday ? theme.colors.primary : theme.colors.outlineVariant,
              backgroundColor: chosen
                ? theme.colors.primary
                : pressed
                  ? theme.colors.primaryContainer
                  : enabled
                    ? theme.colors.surface
                    : 'transparent',
              opacity: enabled ? 1 : 0.5,
            })}
          >
            <Text
              variant="labelMedium"
              style={{
                color: chosen
                  ? theme.colors.onPrimary
                  : isToday
                    ? theme.colors.primary
                    : theme.colors.onSurface,
              }}
            >
              {day.short}
            </Text>
            <Text
              variant="labelSmall"
              style={{
                color: chosen ? theme.colors.onPrimary : theme.tokens.mutedForeground,
                fontVariant: ['tabular-nums'],
              }}
            >
              {count > 0 ? count : '–'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
