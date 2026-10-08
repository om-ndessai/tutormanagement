// Ported from apps/web/src/features/progress/rating.tsx @ 1132322 (the pieces the dashboard and
// the reflection sheet and the session form use)
import { PROGRESS_STATUS_LABELS, TOPIC_RATING_LABELS, type ProgressStatus, type Rating } from '@tmi/shared';
import { Platform, Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { haptics } from '@/lib/haptics';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import type { AppTheme } from '@/theme/paper-theme';
import { MIN_TARGET, radius } from '@/theme/tokens';

const RATINGS: readonly Rating[] = [1, 2, 3, 4, 5];

/** Fill and text for one step of the 1-5 scale, from the palette's rating tokens. */
export function ratingStyle(theme: AppTheme, rating: Rating) {
  const t = theme.tokens;
  const fills = [t.rating1, t.rating2, t.rating3, t.rating4, t.rating5] as const;
  const inks = [t.rating1Ink, t.rating2Ink, t.rating3Ink, t.rating4Ink, t.rating5Ink] as const;
  return { backgroundColor: fills[rating - 1]!, color: inks[rating - 1]! };
}

const CHIP = 24;

/**
 * A score as a small filled square with its number. The number is always printed, so the colour
 * is never the only way to read it.
 */
export function RatingChip({
  rating,
  labels = TOPIC_RATING_LABELS,
  size = CHIP,
}: {
  rating: Rating | null;
  labels?: Record<Rating, string>;
  size?: number;
}) {
  const theme = useAppTheme();
  if (rating === null) {
    return (
      <View
        accessible
        accessibilityLabel="Not rated"
        style={{
          width: size,
          height: size,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.outline,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 12, color: theme.tokens.mutedForeground }}>–</Text>
      </View>
    );
  }
  const style = ratingStyle(theme, rating);
  return (
    <View
      accessible
      accessibilityLabel={`${rating}, ${labels[rating]}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: style.backgroundColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: style.color, fontVariant: ['tabular-nums'] }}>
        {rating}
      </Text>
    </View>
  );
}

/**
 * A value on a CENTRED 1-5 scale, as a chip: neutral in the middle, and the warning tone at
 * either end -- "far too easy" is as much a miss as "far too hard".
 */
export function ScaleChip({ value, labels }: { value: Rating | null; labels: Record<Rating, string> }) {
  const theme = useAppTheme();
  if (value === null) return <RatingChip rating={null} />;
  const extreme = value === 1 || value === 5;
  const warningInk = theme.scheme === 'dark' ? theme.tokens.warning : theme.tokens.warningForeground;
  return (
    <View
      accessible
      accessibilityLabel={`${value}, ${labels[value]}`}
      style={{
        width: CHIP,
        height: CHIP,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: extreme ? withAlpha(theme.tokens.warning, 0.6) : 'transparent',
        backgroundColor: extreme ? withAlpha(theme.tokens.warning, 0.15) : theme.tokens.muted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          color: extreme ? warningInk : theme.colors.onSurface,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const STATUS_ICONS: Record<ProgressStatus, string> = {
  no_plan: 'circle-outline',
  not_started: 'circle-outline',
  ahead: 'trending-up',
  on_track: 'check-circle-outline',
  behind: 'trending-down',
  achieved: 'trophy-outline',
  closed: 'cancel',
};

/**
 * Where a student stands, as icon + word. Status colours are reserved for exactly this, and never
 * carry the meaning on their own.
 */
export function ProgressStatusBadge({ status }: { status: ProgressStatus }) {
  const theme = useAppTheme();
  const t = theme.tokens;
  const good = status === 'ahead' || status === 'on_track' || status === 'achieved';
  const color = good
    ? t.success
    : status === 'behind'
      ? theme.scheme === 'dark'
        ? t.warning
        : t.warningForeground
      : t.mutedForeground;
  const border = good
    ? withAlpha(t.success, 0.4)
    : status === 'behind'
      ? withAlpha(t.warning, 0.6)
      : theme.colors.outline;
  return (
    <View
      testID={`progress-status-${status}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: border,
        borderRadius: radius.sm,
        paddingHorizontal: 6,
        paddingVertical: 2,
        flexShrink: 0,
      }}
    >
      <Icon source={STATUS_ICONS[status]} size={12} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '500', color }}>{PROGRESS_STATUS_LABELS[status]}</Text>
    </View>
  );
}

/**
 * Five steps to pick from, as a radio group. Tapping the chosen step again clears it
 * (`allowClear`). For a CENTRED scale (`neutral`: difficulty and pace, where 3 is right and 1 and
 * 5 are the two ways to miss) the chosen step takes the primary colour instead of the rating
 * ramp, which would read darker as better.
 */
export function RatingPicker({
  value,
  onChange,
  labels = TOPIC_RATING_LABELS,
  name,
  allowClear = true,
  neutral = false,
  testID,
}: {
  value: Rating | null;
  onChange: (value: Rating | null) => void;
  labels?: Record<Rating, string>;
  /** Accessible name of the group, e.g. the question being answered. */
  name: string;
  allowClear?: boolean;
  neutral?: boolean;
  /** Each step is `<testID>-<n>`. */
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={name} style={{ flexDirection: 'row', gap: 6 }}>
      {RATINGS.map((rating) => {
        const selected = value === rating;
        const fill = selected
          ? neutral
            ? { backgroundColor: theme.colors.primary, color: theme.colors.onPrimary }
            : ratingStyle(theme, rating)
          : null;
        return (
          <Pressable
            key={rating}
            testID={testID ? `${testID}-${rating}` : undefined}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${rating} – ${labels[rating]}`}
            onPress={() => {
              haptics.selection();
              onChange(selected && allowClear ? null : rating);
            }}
            style={({ pressed }) => ({
              width: MIN_TARGET,
              height: MIN_TARGET,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: fill ? 'transparent' : theme.colors.outline,
              backgroundColor: fill?.backgroundColor ?? (pressed ? theme.tokens.muted : 'transparent'),
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                fontVariant: ['tabular-nums'],
                color: fill?.color ?? theme.tokens.mutedForeground,
              }}
            >
              {rating}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A topic as its code and name: "BA3.10 Long division", with the unit when it has one. */
export function TopicName({
  id,
  name,
  unit,
}: {
  id: string;
  name: string | undefined;
  unit?: string | null;
}) {
  const theme = useAppTheme();
  return (
    <Text variant="bodyMedium" style={{ flexShrink: 1 }}>
      <Text
        style={{
          fontSize: 11,
          fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
          color: theme.tokens.mutedForeground,
        }}
      >
        {id}{' '}
      </Text>
      {name ?? 'Unknown topic'}
      {unit ? <Text style={{ fontSize: 12, color: theme.tokens.mutedForeground }}> ({unit})</Text> : null}
    </Text>
  );
}
