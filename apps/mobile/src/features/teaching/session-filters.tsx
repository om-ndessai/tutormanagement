// The sessions list's date filter (the web's From / To inputs in sessions-page.tsx): the common
// ranges as chips, and a custom range with the platform's date pickers.
import { ScrollView, View } from 'react-native';
import { Chip } from 'react-native-paper';

import { DateTimeField } from '@/components/date-time-field';
import { haptics } from '@/lib/haptics';
import { space } from '@/theme/tokens';
import {
  SESSION_RANGES,
  SESSION_RANGE_LABELS,
  rangeBounds,
  shiftDay,
  type DateBounds,
  type SessionRange,
} from './session-ranges';

export function SessionFilters({
  range,
  bounds,
  today,
  onChange,
}: {
  range: SessionRange;
  bounds: DateBounds;
  /** Today on the organization's clock. */
  today: string;
  onChange: (range: SessionRange, bounds: DateBounds) => void;
}) {
  function choose(next: SessionRange) {
    if (next === range) return;
    haptics.selection();
    if (next === 'custom') {
      // A custom range starts from what is showing, or the last 30 days.
      onChange('custom', {
        from: bounds.from || shiftDay(today, -29),
        to: bounds.to && bounds.to <= today ? bounds.to : today,
      });
    } else {
      onChange(next, rangeBounds(next, today));
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Which lessons"
      >
        {SESSION_RANGES.map((option) => (
          <Chip
            key={option}
            testID={`sessions-range-${option}`}
            selected={range === option}
            showSelectedCheck={false}
            mode={range === option ? 'flat' : 'outlined'}
            accessibilityRole="radio"
            accessibilityState={{ checked: range === option }}
            onPress={() => choose(option)}
          >
            {SESSION_RANGE_LABELS[option]}
          </Chip>
        ))}
      </ScrollView>
      {range === 'custom' ? (
        <View style={{ gap: space.xs }}>
          <DateTimeField
            mode="date"
            testID="sessions-from"
            label="From"
            value={bounds.from}
            maximumDate={bounds.to || today}
            onChange={(from) => onChange('custom', { ...bounds, from })}
          />
          <DateTimeField
            mode="date"
            testID="sessions-to"
            label="To"
            value={bounds.to}
            minimumDate={bounds.from || undefined}
            onChange={(to) => onChange('custom', { ...bounds, to })}
          />
        </View>
      ) : null}
    </View>
  );
}
