// Ported from apps/web/src/features/habit/my-progress-card.tsx @ 0e3ec7a (working tree). Phase 64
// (P17-P18, docs/stickiness-plan.md): "My progress" on the Play home -- the weekly streak (weeks in a row
// with 3 days played), today's ring, and the badges earned. The reader's own (R28); derived on every
// read, never stored. Nothing until it has loaded, as on the web.
//
// Mobile: the ring and the streak on one row, the badges wrapping beneath (a phone is too narrow for the
// web's one line); a badge's description is its accessibility hint (the web's title).
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useHabit } from './api';
import { NO_BADGE_TEXT, daysLine, earnedOf, streakLine, todayLabel } from './habit-model';

export function MyProgressCard() {
  const theme = useAppTheme();
  const habit = useHabit();
  const data = habit.data?.data;
  if (!data) return null;
  const earned = earnedOf(data);
  const played = data.played_today;
  return (
    <OutlinedCard testID="my-progress" style={{ borderRadius: radius.lg }}>
      <View style={{ padding: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View
            testID="my-progress-today"
            accessible
            accessibilityRole="image"
            accessibilityLabel={todayLabel(played)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: played ? theme.colors.primary : theme.colors.outlineVariant,
              backgroundColor: played ? withAlpha(theme.colors.primary, 0.1) : 'transparent',
            }}
          >
            <Icon
              source="fire"
              size={22}
              color={played ? theme.colors.primary : theme.tokens.mutedForeground}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text testID="my-progress-streak" variant="titleSmall" style={{ fontWeight: '700' }}>
              {streakLine(data.streak_weeks)}
            </Text>
            <Text variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
              {daysLine(data.days_this_week)}
            </Text>
          </View>
        </View>
        <View
          accessibilityLabel="Badges"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
        >
          {earned.length === 0 ? (
            <Text testID="my-progress-no-badge" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
              {NO_BADGE_TEXT}
            </Text>
          ) : (
            earned.map((badge) => (
              <View
                key={badge.id}
                testID={`badge-${badge.id}`}
                accessible
                accessibilityLabel={`Badge: ${badge.label}`}
                accessibilityHint={badge.description}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: space.sm,
                  paddingVertical: 3,
                  borderRadius: radius.pill,
                  backgroundColor: withAlpha(theme.colors.primary, 0.1),
                }}
              >
                <Icon source="medal-outline" size={14} color={theme.colors.primary} />
                <Text variant="labelMedium" style={{ color: theme.colors.primary }}>
                  {badge.label}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </OutlinedCard>
  );
}
