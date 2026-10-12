// Ported from apps/web/src/features/users/availability-picker.tsx @ 1132322.
//
// The web's 7 x 15 grid needs ~500 px across; on a phone it would scroll sideways and hide most of
// the week. Here the week is a row of day chips (each with its count), and the chosen day's hours
// are chips that wrap. Same data either way: one hour block per (day_of_week, hour), 07:00-21:00.
import {
  DAYS_OF_WEEK,
  formatHourShort,
  formatTimeRange,
  groupSlotsByDay,
  type AvailabilitySlot,
} from '@tmi/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

/**
 * Tutoring happens after school and at weekends, so the picker covers 07:00 to 21:00 rather than
 * all 24 hours. The table stores any hour 0-23; this is only what the picker offers.
 */
export const FIRST_HOUR = 7;
export const LAST_HOUR = 21;
const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);

export function toggleSlot(value: AvailabilitySlot[], day_of_week: number, hour: number): AvailabilitySlot[] {
  const on = value.some((slot) => slot.day_of_week === day_of_week && slot.hour === hour);
  return on
    ? value.filter((slot) => !(slot.day_of_week === day_of_week && slot.hour === hour))
    : [...value, { day_of_week, hour }];
}

export function AvailabilityPicker({
  value,
  onChange,
}: {
  value: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  // Start on the first day that already has hours, else Monday.
  const [day, setDay] = useState(() => value[0]?.day_of_week ?? 1);
  const countFor = (d: number) => value.filter((slot) => slot.day_of_week === d).length;
  const selected = new Set(value.filter((slot) => slot.day_of_week === day).map((slot) => slot.hour));
  const summary = groupSlotsByDay(value);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text variant="titleSmall">General availability</Text>
        <Text testID="availability-count" variant="bodySmall" style={{ color: muted }}>
          {`${value.length} hour${value.length === 1 ? '' : 's'} selected`}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 4 }} accessibilityRole="tablist">
        {DAYS_OF_WEEK.map((option) => {
          const chosen = option.value === day;
          const count = countFor(option.value);
          return (
            <Pressable
              key={option.value}
              testID={`availability-day-${option.value}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={`${option.label}, ${count} hour${count === 1 ? '' : 's'}`}
              onPress={() => {
                haptics.selection();
                setDay(option.value);
              }}
              style={{
                flex: 1,
                minHeight: MIN_TARGET + 8,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: chosen ? theme.colors.primary : theme.colors.outline,
                backgroundColor: chosen ? theme.colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
              }}
            >
              <Text
                variant="labelSmall"
                style={{ color: chosen ? theme.colors.onPrimary : theme.colors.onSurface }}
              >
                {option.short}
              </Text>
              <Text style={{ fontSize: 10, color: chosen ? theme.colors.onPrimary : muted }}>
                {count > 0 ? count : '·'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {HOURS.map((hour) => {
          const on = selected.has(hour);
          return (
            <Pressable
              key={hour}
              testID={`availability-hour-${day}-${hour}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${DAYS_OF_WEEK[day]?.label} ${formatTimeRange(hour * 60, (hour + 1) * 60)}`}
              onPress={() => {
                haptics.selection();
                onChange(toggleSlot(value, day, hour));
              }}
              style={{
                width: 56,
                minHeight: MIN_TARGET,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: on ? theme.colors.primary : theme.colors.outline,
                backgroundColor: on ? theme.colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: on ? theme.colors.onPrimary : theme.colors.onSurface }}
              >
                {formatHourShort(hour)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="bodySmall" style={{ color: muted }}>
        Each chip is one hour, starting at the time shown (a = morning, p = afternoon).
      </Text>
      {summary.length > 0 ? (
        <View style={{ gap: 2 }}>
          {summary.map(({ day_of_week, ranges }) => (
            <Text key={day_of_week} variant="bodySmall" style={{ color: muted }}>
              {`${DAYS_OF_WEEK[day_of_week]?.label}: ${ranges
                .map((range) => formatTimeRange(range.start * 60, range.end * 60))
                .join(', ')}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
