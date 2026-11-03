// Ported from apps/web/src/features/home/next-up.tsx @ working tree (Phase 66, H2): the ONE Next up --
// the same choice (`chooseNextUp(nextUpCandidates(home, extras), putOff)`), the same words and the same
// testIDs (`next-up`, `next-up-<kind>`, `next-up-action`, `next-up-later`).
//
// Mobile: a finished lesson is Phase 43's CelebrateCard (Record it now opens the record sheet filled in
// from the schedule); Start opens the existing Start sheet with the student and mode chosen; a waiting
// game's Join opens the existing join sheet by its code (kept from the waiting poll, by game id); the
// directions and meeting link of a lesson about to start are the Now card's. No money anywhere.
import {
  START_LEAD_MINUTES,
  chooseNextUp,
  featureOn,
  gameLengthLabel,
  levelLabel,
  nextUpCandidates,
  nextUpKey,
  type MemberHome,
  type NextUp,
} from '@tmi/shared';
import { router, useIsFocused, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useOrgClock } from '@/features/dashboard/home-data';
import { useDaily } from '@/features/habit/api';
import { dailyTileFor } from '@/features/habit/habit-model';
import { useGuestLeadLevel, useLastQuest, useMemberTiles, useWaitingGames } from '@/features/play/play-api';
import { useStartQuest } from '@/features/play/play-home';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { putOff, usePutOff } from './later';
import {
  capitalise,
  deviceExtras,
  firstOf,
  lessonWithTutor,
  reviewsLine,
  whenWords,
} from './member-home-model';
import { CelebrateCard, NextCard } from './now-card';

/** The one Next up, what it needs to act, and Later. */
export function useNextUp(home: MemberHome | undefined) {
  const { organization } = useAuth();
  const slug = organization?.slug;
  const focused = useIsFocused();
  const quest = featureOn(organization, 'quest');
  const learner = Boolean(home?.hats.includes('learner'));
  // The waiting poll is read only while Home is in front, as the Play home's (at most once a minute).
  const waiting = useWaitingGames(quest && focused);
  const tiles = useMemberTiles(quest && learner);
  const lastQuest = useLastQuest(learner ? slug : undefined);
  const guestLead = useGuestLeadLevel();
  const last = learner ? (lastQuest.data ?? null) : null;
  const list = tiles.data?.data.tiles ?? [];
  const lead = last?.request.level_id ?? guestLead.data ?? null;
  const dailyTile = dailyTileFor(list, lead);
  const dailyLevel = learner && tiles.data?.data.daily && dailyTile ? dailyTile.level_id : null;
  const daily = useDaily(dailyLevel);
  const later = usePutOff(slug, home?.day ?? '');

  const waitingList = quest ? (waiting.data?.data ?? []) : [];
  const dailyDone = daily.data ? daily.data.data.result !== null : null;
  const { extras, codes } = deviceExtras({
    waiting: waitingList,
    lastLabel: last?.label ?? null,
    daily: dailyLevel && dailyDone !== null ? { level_id: dailyLevel, done: dailyDone } : null,
  });
  const item = home ? chooseNextUp(nextUpCandidates(home, extras), later) : null;
  const waitingGame = item?.kind === 'game_invite' ? waitingList.find((g) => g.game_id === item.game.game_id) : undefined;
  return {
    item,
    codes,
    waitingGame,
    last,
    putOff(next: NextUp) {
      if (home) putOff(slug, home.day, nextUpKey(next));
    },
  };
}

function Shell({
  kind,
  icon,
  eyebrow,
  title,
  detail,
  children,
  onLater,
}: {
  kind: string;
  icon: string;
  eyebrow: string;
  title: string;
  detail?: string | null;
  children?: ReactNode;
  onLater?: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View
      testID="next-up"
      accessibilityLabel="Next up"
      collapsable={false}
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.colors.surface,
        padding: space.lg,
        gap: space.md,
      }}
    >
      <View testID={`next-up-${kind}`} collapsable={false} style={{ flexDirection: 'row', gap: space.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.lg,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.tokens.highlightSoft,
          }}
        >
          <Icon source={icon} size={24} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            variant="labelMedium"
            style={{ color: theme.tokens.mutedForeground, letterSpacing: 0.6, textTransform: 'uppercase' }}
          >
            {eyebrow}
          </Text>
          <Text testID="next-up-title" variant="titleLarge" accessibilityRole="header" style={{ fontWeight: '800' }}>
            {title}
          </Text>
          {detail ? (
            <Text testID="next-up-detail" variant="bodyMedium" style={{ color: theme.tokens.mutedForeground }}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
      {children || onLater ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
          {children}
          {onLater ? (
            <Button
              testID="next-up-later"
              mode="text"
              style={{ marginLeft: 'auto' }}
              contentStyle={{ minHeight: 44 }}
              onPress={() => {
                haptics.selection();
                onLater();
              }}
            >
              Later
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Primary({ label, icon, onPress, testID = 'next-up-action', mode = 'contained' }: {
  label: string;
  icon?: string;
  onPress: () => void;
  testID?: string;
  mode?: 'contained' | 'outlined';
}) {
  return (
    <Button
      testID={testID}
      mode={mode}
      icon={icon}
      contentStyle={{ minHeight: 48 }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {label}
    </Button>
  );
}

const go = (href: Href) => () => router.navigate(href);

export function NextUpCard({ home, next }: { home: MemberHome; next: ReturnType<typeof useNextUp> }) {
  const { start, pending } = useStartQuest();
  const clock = useOrgClock();
  const { item, waitingGame, last } = next;
  const later = item ? () => next.putOff(item) : undefined;

  if (!item) {
    return (
      <Shell kind="none" icon="check-circle-outline" eyebrow="Next up" title="You're all caught up." detail="Nothing needs you right now." />
    );
  }

  switch (item.kind) {
    case 'lesson_unrecorded':
      return (
        <View testID="next-up" collapsable={false}>
          <View testID="next-up-lesson_unrecorded" collapsable={false}>
            <CelebrateCard lesson={item.lesson} today={home.day} onLater={later!} />
          </View>
        </View>
      );
    case 'lesson_now':
    case 'lesson_next': {
      // The tutor's own lesson: Phase 43's Now card -- when, where, the homework and the next topic, with
      // Directions or the meeting link and Start from START_LEAD_MINUTES before (else See the plan).
      const now = home.tutor?.now;
      const soon = item.starts_in !== null && item.starts_in <= START_LEAD_MINUTES;
      return (
        <View testID="next-up" collapsable={false}>
          <View testID={`next-up-${item.kind}`} collapsable={false}>
            <NextCard
              lesson={item.lesson}
              brief={now?.next?.schedule_id === item.lesson.schedule_id ? (now?.brief ?? null) : null}
              part={home.part_of_day}
              today={clock.day}
              nowMinutes={clock.minutesOfDay}
              greet={false}
              actionTestID="next-up-action"
              onLater={soon ? later : undefined}
            />
          </View>
        </View>
      );
    }
    case 'child_change': {
      const c = item.child;
      const cancelled = c.cancelled!;
      return (
        <Shell
          kind={item.kind}
          icon="calendar-remove-outline"
          eyebrow="A change"
          title={`${c.first_name}'s lesson ${whenWords(cancelled, home.day)} is cancelled.`}
          detail={c.next_lesson ? `Next: ${lessonWithTutor(c.next_lesson, home.day)}.` : null}
          onLater={later}
        >
          <Primary label="See the schedule" icon="calendar-month-outline" onPress={go('/schedule')} />
        </Shell>
      );
    }
    case 'game_invite': {
      const code = next.codes[item.game.game_id];
      return (
        <Shell
          kind={item.kind}
          icon="target"
          eyebrow="Waiting for you"
          title={`${item.game.host_first_name} started a game.`}
          detail={waitingGame ? `${levelLabel(waitingGame.level_id)} · ${gameLengthLabel(waitingGame)}` : null}
          onLater={later}
        >
          {code ? (
            <Primary
              label="Join"
              icon="account-multiple-plus-outline"
              onPress={() => router.push({ pathname: '/quest/join-game', params: { code } })}
            />
          ) : null}
        </Shell>
      );
    }
    case 'reviews_waiting':
      return (
        <Shell kind={item.kind} icon="clipboard-check-outline" eyebrow="To review" title={`${capitalise(reviewsLine(item.assessments, item.quest))}.`} onLater={later}>
          {item.assessments > 0 ? (
            <Primary label="Review assessments" icon="clipboard-check-outline" onPress={go('/assessments')} />
          ) : null}
          {item.quest > 0 ? (
            <Primary
              testID={item.assessments > 0 ? 'next-up-review-answers' : 'next-up-action'}
              mode={item.assessments > 0 ? 'outlined' : 'contained'}
              label="Review answers"
              onPress={go('/quest/review')}
            />
          ) : null}
        </Shell>
      );
    case 'assessment_continue':
      return (
        <Shell kind={item.kind} icon="pencil-outline" eyebrow="Your assessment" title="Your assessment is waiting for you." detail="Pick up where you left off." onLater={later}>
          <Primary
            label="Continue"
            icon="play"
            onPress={() => router.push({ pathname: '/assessments/[id]', params: { id: item.assessment.id } })}
          />
        </Shell>
      );
    case 'office_to_record': {
      const o = item.office;
      const first = o.to_record[0];
      return (
        <Shell
          kind={item.kind}
          icon="pencil-outline"
          eyebrow="Needs you"
          title={`${o.to_record_count} ${o.to_record_count === 1 ? 'lesson was' : 'lessons were'} not recorded this week.`}
          detail={
            first
              ? `Latest: ${firstOf(first.student_name)} with ${firstOf(first.tutor_name)}, ${whenWords(first, home.day)}.`
              : null
          }
          onLater={later}
        >
          <Primary label="Open sessions" icon="pencil-outline" onPress={go('/sessions')} />
        </Shell>
      );
    }
    case 'daily':
      return (
        <Shell kind={item.kind} icon="target" eyebrow="Today's 5" title="Five questions. Can you hit all five?" onLater={later}>
          <Primary
            label="Play today's 5"
            icon="target"
            onPress={() => router.push({ pathname: '/quest/daily/[level]', params: { level: item.level_id } })}
          />
        </Shell>
      );
    case 'continue_quest':
      return (
        <Shell kind={item.kind} icon="play" eyebrow="Pick up where you left off" title={`Continue ${item.title}.`} onLater={later}>
          <Button
            testID="next-up-action"
            mode="contained"
            icon="play"
            disabled={pending || !last}
            contentStyle={{ minHeight: 48 }}
            onPress={() => last && void start(last.label, last.request)}
          >
            Continue
          </Button>
        </Shell>
      );
    case 'learner_lesson':
      return (
        <Shell
          kind={item.kind}
          icon="calendar-clock"
          eyebrow="Your next lesson"
          title={`${capitalise(lessonWithTutor(item.lesson, home.day))}.`}
        >
          <Primary label="See the schedule" icon="calendar-month-outline" onPress={go('/schedule')} />
        </Shell>
      );
    case 'child_next_lesson': {
      const c = item.child;
      return (
        <Shell
          kind={item.kind}
          icon="calendar-clock"
          eyebrow={`${c.first_name}'s next lesson`}
          title={`${capitalise(lessonWithTutor(c.next_lesson!, home.day))}.`}
          detail={c.homework ? `Homework: ${c.homework}` : null}
        >
          <Primary label="See the schedule" icon="calendar-month-outline" onPress={go('/schedule')} />
        </Shell>
      );
    }
    case 'office_needs': {
      const o = item.office;
      const parts = [
        o.join_requests ? `${o.join_requests} asking to join` : null,
        o.invitations ? `${o.invitations} ${o.invitations === 1 ? 'invitation' : 'invitations'} not yet accepted` : null,
      ].filter(Boolean);
      return (
        <Shell kind={item.kind} icon="account-plus-outline" eyebrow="Needs you" title={parts.join(' · ')} onLater={later}>
          <Primary label="Open people" icon="account-group-outline" onPress={go('/people')} />
        </Shell>
      );
    }
  }
}
