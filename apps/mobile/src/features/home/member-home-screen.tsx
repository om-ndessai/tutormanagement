// Phase 66 (docs/member-home-plan.md H1-H4, H9, H11; build-log entry 75): one Home for everyone, in every
// space -- the band, ONE Next up, quick actions and a section per hat, all from one read (`GET /api/home`)
// plus what only the device knows. The web's half is apps/web/src/features/home (same ids). It replaces
// the role dashboard on Home (now More → Dashboard) and the Phase 50 space home. No money on it.
import {
  featureOn,
  homeGreeting,
  orderHats,
  quickActionsFor,
} from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/screen';
import { DashboardSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { publishHomeRole } from '@/features/dashboard/home-role';
import { useHabit } from '@/features/habit/api';
import { streakLine } from '@/features/habit/habit-model';
import { LessonReminderSheet } from '@/features/locations/lesson-reminder';
import { primaryRole } from '@/features/onboarding/onboarding-model';
import { useOptionalOnboarding } from '@/features/onboarding/onboarding-provider';
import { useTourScroller } from '@/features/onboarding/tour-targets';
import { InvitationBanner } from '@/features/organizations/invitation-banner';
import { PlayFavorites, WaitingForYou } from '@/features/play/play-home';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { useMemberHome } from './api';
import { HomeBand } from './home-band';
import { HomeSections } from './home-sections';
import { stripLine } from './member-home-model';
import { NextUpCard, useNextUp } from './next-up-card';
import { QuickActions } from './quick-actions';
import { SpaceNotes } from './space-notes';

export function MemberHomeScreen() {
  const { user, organization } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const query = useMemberHome();
  const home = query.data?.data;
  const next = useNextUp(home);
  const quest = featureOn(organization, 'quest');
  const tutoring = featureOn(organization, 'tutoring');

  const hats = home ? orderHats(home) : [];
  const learner = hats.includes('learner');
  // The streak is the learner's strip only without a next lesson, where Quest is on.
  const wantsStreak = hats[0] === 'learner' && quest && !home?.learner?.next_lesson;
  const habit = useHabit(wantsStreak);
  const streak = wantsStreak && habit.data ? streakLine(habit.data.data.streak_weeks) : null;

  // Read again whenever Home comes back into view (the first focus is the mount's own read).
  const focusedOnce = useRef(false);
  const refetch = query.refetch;
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refetch();
      focusedOnce.current = true;
    }, [refetch]),
  );

  // No role chips: Home is the same for every role; the role dashboards are More → Dashboard.
  useEffect(() => publishHomeRole(null), []);

  // The welcome wizard and the tour start as they did on the dashboard.
  const onboarding = useOptionalOnboarding();
  const reportDashboard = onboarding?.reportDashboard;
  const role = user ? primaryRole(user.roles) : null;
  useEffect(() => {
    if (role) reportDashboard?.({ role, viewingAs: false });
  }, [reportDashboard, role]);
  const tourScroller = useTourScroller();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(
        [['home'], ['quest'], ['quest-games', 'favorites'], ['canvas-assessments'], ['schedules'], ['users']].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      );
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const actions = home
    ? quickActionsFor(hats, {
        tutoring,
        quest,
        assessment: featureOn(organization, 'assessment'),
        mayBringPeople: home.may_bring_people,
      })
    : [];

  return (
    <Screen testID="screen-home" scrollRef={tourScroller} refreshing={refreshing} onRefresh={() => void onRefresh()}>
      {/* Phase 60 (S6): an invitation to another space, while the reader is here. */}
      <InvitationBanner />
      {query.isPending ? (
        <DashboardSkeleton testID="home-loading" />
      ) : query.isError || !home ? (
        <ErrorState error={query.error} onRetry={() => void refetch()} />
      ) : (
        <View testID="member-home" style={{ gap: space.lg }}>
          <HomeBand greeting={homeGreeting(home)} strip={stripLine(home, hats[0], streak)} />
          <NextUpCard home={home} next={next} />
          <QuickActions actions={actions} />
          <HomeSections home={home} hats={hats} item={next.item} />
          <SpaceNotes learner={learner} />
          {/* Phase 62 (P6): where Quest is on, staff and parents keep their favorites and Waiting for you. */}
          {quest && !learner ? (
            <>
              <PlayFavorites compact />
              <WaitingForYou />
            </>
          ) : null}
        </View>
      )}
      {/* Phase 33: a lesson about to start, where its locations ask for a reminder. */}
      {tutoring ? <LessonReminderSheet /> : null}
    </Screen>
  );
}
