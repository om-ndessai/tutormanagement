// Phase 66 (docs/member-home-plan.md H1-H4, H9, H11; build-log entry 75): one Home for everyone, in every
// space -- the band, ONE Next up, quick actions and a section per hat, all from one read (`GET /api/home`)
// plus what only the device knows. The web's half is apps/web/src/features/home (same ids). It replaces
// the role dashboard on Home (now More → Dashboard) and the Phase 50 space home. No money on it.
//
// Phase 74 (docs/journey-fixes-plan.md, owner 2026-11-05): the sections in the server's hat order (a parent's child,
// then the office, then the board where Tutoring is off -- `orderHats` adds only today-first and the pin); the band's
// doors for a learner who has not played here, and a line that never repeats Next up (JF6, JF16, JF23); the board's
// Daily and Continue quiet while Next up shows them, no New Quest quick action beside the board (JF23); the tour's
// offer is a card at the top of the page, not a layer over it (JF25).
import { featureOn, homeGreeting, mayAddPeople, orderHats, quickActionsFor } from '@tmi/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Screen } from '@/components/screen';
import { DashboardSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/state-views';
import { publishHomeRole } from '@/features/dashboard/home-role';
import { useHabit } from '@/features/habit/api';
import { streakLine } from '@/features/habit/habit-model';
import { LessonReminderSheet } from '@/features/locations/lesson-reminder';
import { primaryRole } from '@/features/onboarding/onboarding-model';
import { TourOfferCard, useOptionalOnboarding } from '@/features/onboarding/onboarding-provider';
import {
  resolveTarget,
  scrollIntoView,
  TourTarget,
  useTourRegistry,
  useTourScroller,
} from '@/features/onboarding/tour-targets';
import { InvitationBanner } from '@/features/organizations/invitation-banner';
import { KeptForYou } from '@/features/organizations/kept-for-you';
import { canMake } from '@/features/organizations/space-model';
import { YourRequestsCard } from '@/features/organizations/your-requests';
import { PlayFavorites, WaitingForYou, openNewQuestFromHome } from '@/features/play/play-home';
import { useAuth } from '@/providers/auth-provider';
import { space } from '@/theme/tokens';
import { useMemberHome } from './api';
import { HomeBand } from './home-band';
import { HomeSections } from './home-sections';
import { bandDoors, NEWCOMER_STRIP, stripLine, type BandDoor } from './member-home-model';
import { NextUpCard, useNextUp } from './next-up-card';
import { PinHome } from './pin-home';
import { QuickActions } from './quick-actions';
import { SpaceNotes } from './space-notes';

export function MemberHomeScreen() {
  const { user, organization, account, memberships, platformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const query = useMemberHome();
  const home = query.data?.data;
  const next = useNextUp(home);
  const quest = featureOn(organization, 'quest');
  const tutoring = featureOn(organization, 'tutoring');
  const registry = useTourRegistry();
  const reduced = useReducedMotion();

  const hats = home ? orderHats(home) : [];
  const learner = hats.includes('learner');
  // The learner's band, where Quest is on: the streak in words, and -- for someone who has not played here -- the doors
  // (the same read as Next up's, so no second request).
  const learnerBand = hats[0] === 'learner' && quest;
  const habit = useHabit(learnerBand);
  const summary = learnerBand ? habit.data?.data : undefined;
  const streak = summary ? streakLine(summary.streak_weeks) : null;
  const doors = bandDoors({
    hat: hats[0],
    quest,
    playedBefore: summary?.played_before,
    mayMakeSpace: canMake(account, memberships ?? [], platformAdmin ?? false),
  });

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

  // The Quest board is on the home for a learner where Quest (and the console's Play home) is on.
  const board = learner && quest && next.playHome;
  const actions = home
    ? quickActionsFor(hats, {
        tutoring,
        quest,
        assessment: featureOn(organization, 'assessment'),
        // Adding people: what the server says (a teen brings nobody) AND the one shared rule (JF22).
        mayBringPeople: home.may_bring_people && mayAddPeople({ roles: user?.roles ?? [], account }),
        // Someone to start an assessment for here (absent from older Workers: true).
        mayAssess: home.may_assess,
        // The board's own New Quest and the band's own Join with a code (JF23), left out before the cut to three.
        board,
        doors: doors.includes('code'),
      })
    : [];

  /** "Play": down to the board (its own Daily and tiles); without one on screen, today's Daily, else New Quest. */
  const playDoor = useCallback(async () => {
    const target = await resolveTarget(registry, 'home-board');
    if (target && (await scrollIntoView(registry, target.view, 120, !reduced))) return;
    if (next.dailyLevel) router.push({ pathname: '/quest/daily/[level]', params: { level: next.dailyLevel } });
    else openNewQuestFromHome();
  }, [registry, reduced, next.dailyLevel]);
  const doorActions: Record<BandDoor, () => void> = {
    play: () => void playDoor(),
    code: () => router.push('/have-a-code'),
    start: () => router.push({ pathname: '/spaces', params: { start: '1' } }),
  };

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
          {/* Phase 74 (JF25): the tour's offer, in the page's flow at its top -- never a layer over the work. */}
          <TourOfferCard />
          {/* Phase 72 (UI audit JF4, JF9): a code kept on this phone signed out, or a quest a friend sent, offered once. */}
          <KeptForYou />
          {/* The tour starts on the home's blocks (Phase 66, as the web's data-tour ids). */}
          <TourTarget id="home-band">
            <HomeBand
              greeting={homeGreeting(home)}
              strip={doors.length > 0 ? NEWCOMER_STRIP : stripLine(home, hats[0], streak, { next: next.item, tutoring })}
              doors={doors.map((door) => ({ door, onPress: doorActions[door] }))}
            />
          </TourTarget>
          {/* UI audit (JF5): the person's requests to join other spaces, and the answers, until dismissed. */}
          <YourRequestsCard />
          <TourTarget id="home-next-up">
            <NextUpCard home={home} next={next} />
          </TourTarget>
          <QuickActions actions={actions} />
          <HomeSections home={home} hats={hats} item={next.item} practiceLevelId={next.practiceLevelId} />
          <SpaceNotes learner={learner} />
          {/* Phase 62 (P6): where Quest is on, staff and parents keep their favorites and Waiting for you. */}
          {quest && !learner ? (
            <>
              <PlayFavorites compact />
              <WaitingForYou />
            </>
          ) : null}
          {/* Phase 68 (H4): "Make this my home", at the foot, as the web's. */}
          <PinHome home={home} />
        </View>
      )}
      {/* Phase 33: a lesson about to start, where its locations ask for a reminder. */}
      {tutoring ? <LessonReminderSheet /> : null}
    </Screen>
  );
}
