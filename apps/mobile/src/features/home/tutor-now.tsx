// The top of a tutor's Tutoring tab (Phase 43): the Now card, then the brief for the next lesson.
// Also an admin's who tutors (the owner, 2026-10-20), for their own pairings. Someone who teaches
// nobody gets an empty answer and sees nothing here. Never while an admin views someone else: the
// route answers for the reader alone.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';

import { useOrgClock } from '@/features/dashboard/home-data';
import { useActiveSession } from '@/features/teaching/api';
import { space } from '@/theme/tokens';
import { useTutorHome } from './api';
import { BriefCards } from './brief-cards';
import { usePutOff } from './later';
import { CelebrateCard, NextCard } from './now-card';
import { nowState, type NowState } from './now-model';

/** The Now card's state for the reader, read once by Home (the greeting) and once by the card. */
export function useNowState(enabled = true): { state: NowState; home: ReturnType<typeof useTutorHome> } {
  const home = useTutorHome(enabled);
  const active = useActiveSession();
  const later = usePutOff();
  const running = Boolean(active.data?.data.mine);
  return { state: nowState(enabled ? home.data?.data : null, { running, later }), home };
}

export function TutorNow() {
  const { state, home } = useNowState();
  const clock = useOrgClock();
  const data = home.data?.data;

  // Read again whenever Home comes back into view (the first focus is the mount's own read).
  const focused = useRef(false);
  const refetch = home.refetch;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refetch();
      focused.current = true;
    }, [refetch]),
  );

  if (!data) return null;
  const card =
    state.kind === 'celebrate' ? (
      <CelebrateCard lesson={state.lesson} today={clock.day} />
    ) : state.kind === 'next' ? (
      <NextCard
        lesson={state.lesson}
        brief={data.brief}
        part={data.part_of_day}
        today={clock.day}
        nowMinutes={clock.minutesOfDay}
      />
    ) : null;
  const brief = data.next && data.brief ? <BriefCards lesson={data.next} brief={data.brief} today={clock.day} /> : null;
  if (!card && !brief) return null;
  return (
    <View testID="home-now" style={{ gap: space.md }}>
      {card}
      {brief}
    </View>
  );
}
