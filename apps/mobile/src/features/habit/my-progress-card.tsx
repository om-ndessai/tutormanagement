// Ported from apps/web/src/features/habit/my-progress-card.tsx @ 0e3ec7a (working tree). Phase 64
// (P17-P18, docs/stickiness-plan.md): "My progress" on the Play home -- the weekly streak (weeks in a row
// with 3 days played), today's ring, and the badges earned. The reader's own (R28); derived on every
// read, never stored. Nothing until it has loaded, as on the web.
//
// Mobile: the ring and the streak on one row, the badges wrapping beneath (a phone is too narrow for the
// web's one line); a badge's description is its accessibility hint (the web's title).
//
// Phase 67 (H8): the week as seven dots with the 3-day target, "Welcome back" after a week away (never a
// loss message), and the next badge within reach. An older Worker sends none of them: shown as before.
//
// Phase 73 (JF16): ONE headline from the current run (`progressHeadline`): the streak, "Start a streak", or
// after a week away the welcome in its place -- never two that disagree. Badges once earned stay listed.
import type { WeekDot } from '@tmi/shared';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { useAppTheme } from '@/providers/theme-provider';
import { withAlpha } from '@/theme/alpha';
import { radius, space } from '@/theme/tokens';
import { useHabit } from './api';
import {
  NO_BADGE_TEXT,
  WEEK_DAY_NAMES,
  earnedOf,
  nextBadgeLine,
  progressHeadline,
  todayLabel,
  weekDotLabel,
} from './habit-model';

export function MyProgressCard() {
  const theme = useAppTheme();
  const habit = useHabit();
  const data = habit.data?.data;
  if (!data) return null;
  const earned = earnedOf(data);
  const played = data.played_today;
  const headline = progressHeadline(data);
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
          {/* The one state; after a week away a kind word in place of the streak (`my-progress-welcome`). */}
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              testID={headline.welcome ? 'my-progress-welcome' : 'my-progress-streak'}
              variant="titleSmall"
              style={{ fontWeight: '700', color: headline.welcome ? theme.colors.primary : theme.colors.onSurface }}
            >
              {headline.title}
            </Text>
            <Text testID="my-progress-detail" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
              {headline.detail}
            </Text>
          </View>
        </View>
        {/* Phase 67 (H8): this week as seven dots, Monday first; absent from an older Worker. */}
        {data.week ? <WeekStrip week={data.week} /> : null}
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
        {data.next_badge ? (
          <Text testID="my-progress-next" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
            {nextBadgeLine(data.next_badge)}
          </Text>
        ) : null}
      </View>
    </OutlinedCard>
  );
}

/** Seven dots, Monday first: filled when played, ringed for today, faint for the rest. */
function WeekStrip({ week }: { week: readonly WeekDot[] }) {
  const theme = useAppTheme();
  return (
    <View testID="my-progress-week" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {week.map((dot, i) => {
        const played = dot === 'played';
        const today = dot === 'today';
        return (
          <View
            key={i}
            testID={`my-progress-day-${i}`}
            accessible
            accessibilityLabel={weekDotLabel(i, dot)}
            style={{ alignItems: 'center', gap: 4, minWidth: 32 }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: today ? 2 : 1.5,
                borderColor: played || today ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: played ? theme.colors.primary : 'transparent',
              }}
            >
              {played ? <Icon source="check" size={16} color={theme.colors.onPrimary} /> : null}
            </View>
            <Text
              variant="labelSmall"
              aria-hidden
              style={{ color: today ? theme.colors.primary : theme.tokens.mutedForeground, fontWeight: today ? '700' : '400' }}
            >
              {WEEK_DAY_NAMES[i]!.slice(0, 1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
