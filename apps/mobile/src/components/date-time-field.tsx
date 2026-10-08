// A calendar date or a clock time, picked with the platform's own picker: on iOS the compact
// picker beside its label, on Android a field that opens the system dialog. Values are the
// strings the API takes ("2026-09-15", "16:30"). The picker works in UTC (`timeZoneName`), so a
// date or a time never shifts with the device's zone: they are already on the organization's
// clock, and nothing here converts an instant.
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { formatClockTime, parseClockTime } from '@tmi/shared';
import { Platform, Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';

type Mode = 'date' | 'time';

/** "2026-09-15" or "16:30" as the Date the picker shows (in UTC). */
export function toPickerDate(mode: Mode, value: string): Date {
  if (mode === 'date') return new Date(`${value}T12:00:00Z`);
  const minutes = parseClockTime(value) ?? 0;
  return new Date(Date.UTC(2000, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

/** The picker's Date back to "2026-09-15" or "16:30". */
export function fromPickerDate(mode: Mode, date: Date): string {
  const iso = date.toISOString();
  return mode === 'date' ? iso.slice(0, 10) : iso.slice(11, 16);
}

function display(mode: Mode, value: string): string {
  if (mode === 'time') return formatClockTime(value);
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function DateTimeField({
  mode,
  label,
  value,
  onChange,
  maximumDate,
  minimumDate,
  testID,
  error,
}: {
  mode: Mode;
  label: string;
  /** "YYYY-MM-DD" for a date, "HH:MM" for a time. */
  value: string;
  onChange: (value: string) => void;
  /** For a date: the latest day that may be chosen, "YYYY-MM-DD". */
  maximumDate?: string;
  minimumDate?: string;
  testID?: string;
  error?: boolean;
}) {
  const theme = useAppTheme();
  const picked = toPickerDate(mode, value);
  const max = maximumDate ? toPickerDate('date', maximumDate) : undefined;
  const min = minimumDate ? toPickerDate('date', minimumDate) : undefined;
  const labelColor = error ? theme.colors.error : theme.tokens.mutedForeground;

  if (Platform.OS === 'ios') {
    return (
      <View
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: MIN_TARGET,
          gap: space.sm,
        }}
      >
        <Text variant="bodyMedium" style={{ color: labelColor }}>
          {label}
        </Text>
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          value={picked}
          mode={mode}
          display="compact"
          timeZoneName="UTC"
          minuteInterval={mode === 'time' ? 5 : undefined}
          maximumDate={max}
          minimumDate={min}
          accentColor={theme.colors.primary}
          themeVariant={theme.dark ? 'dark' : 'light'}
          accessibilityLabel={`${label}: ${display(mode, value)}`}
          onChange={(event, date) => {
            if (event.type === 'set' && date) {
              haptics.selection();
              onChange(fromPickerDate(mode, date));
            }
          }}
        />
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${display(mode, value)}`}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: picked,
          mode,
          timeZoneName: 'UTC',
          maximumDate: max,
          minimumDate: min,
          is24Hour: false,
          onChange: (event, date) => {
            if (event.type === 'set' && date) {
              haptics.selection();
              onChange(fromPickerDate(mode, date));
            }
          },
        })
      }
      style={({ pressed }) => ({
        minHeight: MIN_TARGET + 4,
        borderWidth: 1,
        borderColor: error ? theme.colors.error : theme.colors.outline,
        borderRadius: radius.sm,
        paddingHorizontal: space.md,
        paddingVertical: 6,
        justifyContent: 'center',
        backgroundColor: pressed ? theme.tokens.muted : 'transparent',
      })}
    >
      <Text style={{ fontSize: 11, color: labelColor }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon source={mode === 'date' ? 'calendar' : 'clock-outline'} size={16} color={labelColor} />
        <Text variant="bodyLarge">{display(mode, value)}</Text>
      </View>
    </Pressable>
  );
}
