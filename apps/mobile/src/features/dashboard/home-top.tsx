// The top of Home (UI upgrades U6): a greeting on the organization's clock, then Today. No money:
// what is here shows above the Tutoring tab too, which a tutor may have open beside a student.
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';

import { OutlinedCard } from '@/components/outlined-card';
import { Skeleton } from '@/components/skeleton';
import { useSessions } from '@/features/teaching/api';
import { useLargeText } from '@/hooks/use-large-text';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { useOrgClock, useUpcomingThrough } from './home-data';
import { greeting, summarizeToday, upcomingHorizon, type TodaySummary, type TodayWho } from './home-model';

/** "Good afternoon, Priya", with the organization's short name under it. */
export function Greeting() {
  const { user } = useAuth();
  const brand = useBrand();
  const theme = useAppTheme();
  const large = useLargeText();
  const clock = useOrgClock();
  return (
    <View style={{ gap: 0 }}>
      <Text
        testID="home-greeting"
        variant="headlineSmall"
        accessibilityRole="header"
        style={{ fontWeight: '700' }}
      >
        {greeting(user?.full_name, clock.minutesOfDay)}
      </Text>
      {/* Under large text the line gives its room to the dashboard (ux-audit F-12, F-15); the
          account sheet names the organization too. */}
      {large ? null : (
        <Text testID="home-org" variant="bodySmall" style={{ color: theme.tokens.mutedForeground }}>
          {brand.short}
        </Text>
      )}
    </View>
  );
}

/**
 * Whose lessons Today counts. A tutor's are narrowed by `tutorUserId` at the server (as their
 * carousel is); a family's by `studentIds` here, so someone who tutors and parents sees only their
 * children's on the parent's Home, and an admin viewing a family sees only theirs.
 */
export interface TodayScope {
  who: TodayWho;
  tutorUserId?: string;
  studentIds?: string[];
  /** How many days ahead to read the schedules (a family's child cards look two weeks on). */
  horizonDays?: number;
}

function forStudents<T extends { student_user_id: string }>(list: T[], ids: Set<string> | null): T[] {
  return ids === null ? list : list.filter((row) => ids.has(row.student_user_id));
}

/** Today's figures and the upcoming lessons in scope, through the horizon. */
export function useToday({ who, tutorUserId, studentIds, horizonDays = 0 }: TodayScope) {
  const clock = useOrgClock();
  const upcoming = useUpcomingThrough(upcomingHorizon(clock.day, horizonDays), tutorUserId);
  const single = studentIds?.length === 1 ? studentIds[0] : undefined;
  const recorded = useSessions({
    from: clock.day,
    to: clock.day,
    limit: 200,
    ...(tutorUserId ? { tutor_user_id: tutorUserId } : {}),
    ...(single ? { student_user_id: single } : {}),
  });
  const key = studentIds?.join(',');
  const ids = useMemo(() => (key === undefined ? null : new Set(key.split(',').filter(Boolean))), [key]);

  const lessons = useMemo(() => forStudents(upcoming.data ?? [], ids), [ids, upcoming.data]);
  const recordedToday = useMemo(
    () => forStudents(recorded.data?.data ?? [], ids).filter((row) => row.occurred_on === clock.day).length,
    [ids, recorded.data, clock.day],
  );
  const summary = useMemo(
    () =>
      summarizeToday({
        upcoming: lessons,
        recordedToday,
        today: clock.day,
        nowMinutes: clock.minutesOfDay,
        who,
      }),
    [lessons, recordedToday, clock.day, clock.minutesOfDay, who],
  );
  return {
    summary,
    lessons,
    today: clock.day,
    pending: upcoming.isPending || recorded.isPending,
    failed: upcoming.isError,
  };
}

/** "2 lessons today" / "Next at 4:00 PM with Sofia". Opens the schedule. */
export function TodayCard({
  summary,
  pending,
  failed,
}: {
  summary: TodaySummary;
  pending: boolean;
  failed: boolean;
}) {
  const theme = useAppTheme();
  const quiet = summary.count === 0;
  const detail = failed ? 'The schedule could not be read. Pull down to try again.' : summary.detail;
  return (
    <OutlinedCard
      testID="home-today"
      style={{
        borderRadius: radius.lg,
        backgroundColor: quiet ? theme.colors.surface : theme.tokens.highlightSoft,
        borderColor: quiet ? theme.colors.outlineVariant : theme.tokens.highlightSoft,
      }}
      contentStyle={{ padding: 0 }}
    >
      <Pressable
        testID="home-today-open"
        accessibilityRole="link"
        accessibilityLabel={pending ? 'Today: loading' : `Today: ${summary.headline}. ${detail}`}
        onPress={() => router.navigate('/schedule')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: quiet ? theme.tokens.muted : theme.tokens.highlight,
          }}
        >
          <Icon
            source={quiet ? 'weather-sunny' : 'calendar-today'}
            size={22}
            color={quiet ? theme.tokens.mutedForeground : theme.tokens.highlightForeground}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          {pending ? (
            <View style={{ gap: 6, paddingVertical: 2 }}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="80%" height={14} />
            </View>
          ) : (
            <>
              <Text testID="home-today-headline" variant="titleMedium" style={{ fontWeight: '700' }}>
                {summary.headline}
              </Text>
              <Text
                testID="home-today-detail"
                variant="bodyMedium"
                style={{ color: theme.tokens.mutedForeground }}
              >
                {detail}
              </Text>
            </>
          )}
        </View>
        <Icon source="chevron-right" size={20} color={theme.tokens.mutedForeground} />
      </Pressable>
    </OutlinedCard>
  );
}
