// "When can they learn?" (UI upgrades U3): a week of Morning / After school / Evening toggles over
// the same hour blocks the exact grid edits, with "Fine-tune hours" swapping that grid in. A band
// fine-tuned to part of itself shows a dash (a mixed checkbox); a tap completes it.
import { DAYS_OF_WEEK, formatHourShort, type AvailabilitySlot } from '@tmi/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { MIN_TARGET, radius, space } from '@/theme/tokens';
import { AVAILABILITY_BANDS, bandState, toggleBand, type BandState } from './availability-bands';
import { AvailabilityPicker } from './availability-picker';

export function AvailabilityWeek({
  value,
  onChange,
  testID,
}: {
  value: AvailabilitySlot[];
  onChange: (slots: AvailabilitySlot[]) => void;
  /** The prefix: `<testID>-band-<day>-<band>`, `<testID>-fine-tune`, `<testID>-week`. */
  testID: string;
}) {
  const theme = useAppTheme();
  const muted = theme.tokens.mutedForeground;
  const [fine, setFine] = useState(false);

  if (fine) {
    return (
      <View style={{ gap: space.md }}>
        <AvailabilityPicker value={value} onChange={onChange} />
        <Button
          testID={`${testID}-week`}
          mode="outlined"
          icon="view-week-outline"
          style={{ alignSelf: 'flex-start' }}
          contentStyle={{ minHeight: MIN_TARGET }}
          onPress={() => {
            haptics.selection();
            setFine(false);
          }}
        >
          Back to the week
        </Button>
      </View>
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      {/* The bands' names once, over their columns. */}
      <View style={{ flexDirection: 'row', gap: space.xs }} importantForAccessibility="no-hide-descendants">
        <View style={{ width: DAY_WIDTH }} />
        {AVAILABILITY_BANDS.map((band) => (
          <View key={band.key} style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="labelLarge" numberOfLines={1}>
              {band.label}
            </Text>
            <Text variant="bodySmall" style={{ color: muted }}>
              {`${formatHourShort(band.start)}–${formatHourShort(band.end)}`}
            </Text>
          </View>
        ))}
      </View>
      {DAYS_OF_WEEK.map((day) => (
        <View key={day.value} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text variant="bodyMedium" style={{ width: DAY_WIDTH, color: muted }} importantForAccessibility="no">
            {day.short}
          </Text>
          {AVAILABILITY_BANDS.map((band) => (
            <BandToggle
              key={band.key}
              testID={`${testID}-band-${day.value}-${band.key}`}
              label={`${day.label} ${band.label.toLowerCase()}`}
              state={bandState(value, day.value, band)}
              onPress={() => onChange(toggleBand(value, day.value, band))}
            />
          ))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
        <Text testID={`${testID}-count`} variant="bodySmall" style={{ color: muted, flexGrow: 1 }}>
          {value.length === 0
            ? 'Nothing chosen yet.'
            : `${value.length} hour${value.length === 1 ? '' : 's'} a week`}
        </Text>
        <Button
          testID={`${testID}-fine-tune`}
          mode="text"
          icon="tune-variant"
          contentStyle={{ minHeight: MIN_TARGET }}
          onPress={() => {
            haptics.selection();
            setFine(true);
          }}
        >
          Fine-tune hours
        </Button>
      </View>
    </View>
  );
}

const DAY_WIDTH = 44;

function BandToggle({
  testID,
  label,
  state,
  onPress,
}: {
  testID: string;
  label: string;
  state: BandState;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const on = state === 'all';
  const some = state === 'some';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={some ? `${label}, some hours` : label}
      accessibilityState={{ checked: on ? true : some ? 'mixed' : false }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: MIN_TARGET,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: on || some ? theme.colors.primary : theme.colors.outline,
        backgroundColor: on
          ? theme.colors.primary
          : some
            ? theme.tokens.highlightSoft
            : pressed
              ? theme.tokens.muted
              : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {on ? (
        <Icon source="check" size={20} color={theme.colors.onPrimary} />
      ) : some ? (
        <Icon source="minus" size={20} color={theme.tokens.highlightSoftForeground} />
      ) : null}
    </Pressable>
  );
}
