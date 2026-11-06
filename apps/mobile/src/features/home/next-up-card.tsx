// Ported from apps/web/src/features/home/next-up.tsx @ working tree (Phase 66, H2): the ONE Next up --
// the same choice (`chooseNextUp(nextUpCandidates(home, extras), putOff)`), the same words and the same
// testIDs (`next-up`, `next-up-<kind>`, `next-up-action`, `next-up-later`).
//
// Mobile: a finished lesson is Phase 43's CelebrateCard (Record it now opens the record sheet filled in
// from the schedule); Start opens the existing Start sheet with the student and mode chosen; a waiting
// game's Join opens the existing join sheet by its code (kept from the waiting poll, by game id); the
// directions and meeting link of a lesson about to start are the Now card's. No money anywhere.
//
// Phase 67: two more kinds -- `question_quest` (a student's Quest question waiting; it replaces the
// QuestLanding redirect) and `welcome_back` (back after a week away, from the habit summary).
//
// Phase 68 (H4, H10): `practise_before` (a learner's lesson in the coming week -- `PRACTISE_BEFORE_DAYS`, 7 since
// Phase 74: Practise 5 at the board's lead level) and `focus_default` (an assessment- or quest-led home's first step,
// when nothing else is).
//
// Phase 74 (JF17): a lesson line says where it is ("… with Alex · Institute, room 2"), and the learner's next lesson
// offers practice for it where Quest is on (`next-up-practise`, outlined: Next up's own action stays the heaviest).
//
// Phase 73 (docs/journey-fixes-plan.md; owner 2026-11-05): `open_game` -- the reader's open game, from the
// server, in words with where they are; Continue opens it -- and `continue_quest` is now "again" ("Play
// Grade 7 Quick 5 again"), only with no game open: one tap starts its settings as a tile does (JF13). The
// Daily is "Today's Daily", its level the board's (`dailyLevelFor` of the lead grade, JF14/JF23). An
// invitation's game in words (JF32). New Quest opens with `from=home` (JF36).
//
// Phase 75 (docs/journey-fixes-plan.md JF19, JF30; owner 2026-11-05): a lesson under way leads Next up
// (`lesson_running`, from the client's own `GET /sessions/active`), with Stop and how long it has run; a finished one
// with the reader's draft says "Draft saved 12:43 PM" and continues it; the office's lessons to record open the list
// of lessons still owed. "Lesson" and "Record" on every one.
import {
  DAILY_NAME,
  START_LEAD_MINUTES,
  chooseNextUp,
  dailyLevelFor,
  featureOn,
  lessonDayWords,
  levelLabel,
  TILE_LEVEL_WORDS,
  type QuestionBankLevelId,
  nextUpCandidates,
  nextUpKey,
  practiseRequest,
  SESSION_MODE_LABELS,
  type MemberHome,
  type NextUp,
  type NextUpExtras,
} from '@tmi/shared';
import { router, useIsFocused, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Button, Icon, Text } from 'react-native-paper';

import { useOrgClock } from '@/features/dashboard/home-data';
import { useDaily, useHabit } from '@/features/habit/api';
import { PLAY_DAILY_LABEL, levelWords } from '@/features/habit/habit-model';
import { useGuestLeadLevel, useMemberTiles, useOpenGame, useWaitingGames } from '@/features/play/play-api';
import { openGameFromHome, openNewQuestFromHome, useStartQuest } from '@/features/play/play-home';
import { shownGrade } from '@/features/play/play-model';
import { useQuestState } from '@/features/quest/api';
import { gameWordsOf } from '@/features/quest/game-model';
import { questRoles } from '@/features/quest/quest-model';
import { useActiveSession } from '@/features/teaching/api';
import { runningLine } from '@/features/teaching/lessons-owed-model';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/providers/auth-provider';
import { useAppTheme } from '@/providers/theme-provider';
import { radius, space } from '@/theme/tokens';
import { putOff, usePutOff } from './later';
import {
  capitalise,
  deviceExtras,
  firstOf,
  placeWords,
  questionQuestExtra,
  lessonWithTutor,
  reviewsLine,
  whenWords,
} from './member-home-model';
import { CelebrateCard, NextCard } from './now-card';

/** The one Next up, what it needs to act, and Later. */
export function useNextUp(home: MemberHome | undefined) {
  const { organization, user } = useAuth();
  const slug = organization?.slug;
  const focused = useIsFocused();
  const quest = featureOn(organization, 'quest');
  // Phase 75 (JF30): the reader's own running lesson (the banner's read, shared; polled only where Tutoring is on).
  const active = useActiveSession();
  const running = featureOn(organization, 'tutoring') ? (active.data?.data.mine ?? null) : null;
  const learner = Boolean(home?.hats.includes('learner'));
  // The waiting poll is read only while Home is in front, as the Play home's (at most once a minute).
  const waiting = useWaitingGames(quest && focused);
  const tiles = useMemberTiles(quest && learner);
  // Phase 73 (JF13): Continue's read -- for a learner where Quest is on, while Home is in front.
  const openRead = useOpenGame(quest && learner && focused);
  const open = quest && learner ? (openRead.data?.data ?? null) : null;
  const guestLead = useGuestLeadLevel();
  const list = tiles.data?.data.tiles ?? [];
  // Phase 73 (JF14, JF23): the board's one Daily rule -- the lead grade's first standard card's level.
  const leadGrade = shownGrade(list, null, tiles.data?.data.lead, guestLead.data);
  const leadLevel = list.length > 0 ? dailyLevelFor(list, leadGrade) : null;
  const dailyLevel = learner && tiles.data?.data.daily ? leadLevel : null;
  const daily = useDaily(dailyLevel, { keepPrevious: true });
  const later = usePutOff(slug, home?.day ?? '');
  // Phase 67: a student's Question Quest with a question waiting (the old sign-in landing's read), and
  // "welcome back" from the habit summary -- both only where Quest is on.
  const plays = questRoles(user?.roles).plays;
  const questState = useQuestState(quest && learner && plays);
  const habit = useHabit(quest && learner);

  const waitingList = quest ? (waiting.data?.data ?? []) : [];
  const dailyDone = daily.data ? daily.data.data.result !== null : null;
  const { extras, codes } = deviceExtras({
    waiting: waitingList,
    open,
    daily: dailyLevel && dailyDone !== null ? { level_id: dailyLevel, done: dailyDone } : null,
    questionQuest: quest && learner && plays ? questionQuestExtra(questState.data?.data) : null,
    welcomeBack: quest && learner ? habit.data?.data.welcome_back === true : false,
    // Phase 68 (H10): practice before a lesson starts at the board's lead level.
    practiceLevelId: learner && quest ? leadLevel : null,
    playedToday: habit.data?.data.played_today ?? false,
    running,
  });
  const item = home ? chooseNextUp(nextUpCandidates(home, extras), later) : null;
  const waitingGame = item?.kind === 'game_invite' ? waitingList.find((g) => g.game_id === item.game.game_id) : undefined;
  return {
    item,
    codes,
    waitingGame,
    /** "Again": what the `continue_quest` item starts (the server's last game's settings). */
    again: open?.again ?? null,
    /** Phase 74: where practice for a lesson starts (the board's lead level), for the learner's lesson line. */
    practiceLevelId: learner && quest ? leadLevel : null,
    /** Phase 74: today's Daily's level, for the band's Play door when the board is not on screen. */
    dailyLevel,
    /** Phase 74: whether the console has the Play home on (unknown until the tiles load: assumed on). */
    playHome: tiles.data?.data.play_home ?? true,
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

/** A clock that moves once a minute, for "Running 12 min". */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** Phase 75 (JF30): the lesson under way, first, with Stop -- the stop sheet records it (no money: the length only). */
function RunningLesson({ running }: { running: NonNullable<NextUpExtras['running']> }) {
  const now = useMinuteClock();
  return (
    <Shell
      kind="lesson_running"
      icon="timer-outline"
      eyebrow="Lesson under way"
      title={`Your lesson with ${firstOf(running.student_name)} is running.`}
      detail={`${runningLine(running.started_at, now)} · ${SESSION_MODE_LABELS[running.mode]}`}
    >
      <Primary label="Stop and record" icon="stop" onPress={go('/stop-lesson')} />
    </Shell>
  );
}

export function NextUpCard({ home, next }: { home: MemberHome; next: ReturnType<typeof useNextUp> }) {
  const { start, pending } = useStartQuest();
  const clock = useOrgClock();
  const { item, waitingGame, again } = next;
  const later = item ? () => next.putOff(item) : undefined;

  if (!item) {
    return (
      <Shell kind="none" icon="check-circle-outline" eyebrow="Next up" title="You're all caught up." detail="Nothing needs you right now." />
    );
  }

  switch (item.kind) {
    case 'lesson_running':
      return <RunningLesson running={item.running} />;
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
          detail={waitingGame ? gameWordsOf(waitingGame) : null}
          onLater={later}
        >
          {code ? (
            <Primary
              label="Join"
              icon="account-multiple-plus-outline"
              onPress={() => router.push({ pathname: '/quest/join-game', params: { code, from: 'home' } })}
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
          {/* Phase 75 (JF30): the list of lessons still owed, each with Record. */}
          <Primary label="Record them" icon="pencil-outline" onPress={go('/lessons-owed')} />
        </Shell>
      );
    }
    case 'daily':
      return (
        <Shell
          kind={item.kind}
          icon="target"
          eyebrow={DAILY_NAME}
          title="Five questions. Can you hit all five?"
          detail={levelWords(item.level_id)}
          onLater={later}
        >
          <Primary
            label={PLAY_DAILY_LABEL}
            icon="target"
            onPress={() => router.push({ pathname: '/quest/daily/[level]', params: { level: item.level_id } })}
          />
        </Shell>
      );
    case 'question_quest':
      return (
        <Shell
          kind={item.kind}
          icon="help-circle-outline"
          eyebrow="Your Quest"
          title="Your Quest has a question waiting."
          detail={item.level_id ? levelLabel(item.level_id) : null}
          onLater={later}
        >
          <Primary label="Answer it" icon="play" onPress={() => router.push('/quest/play')} />
        </Shell>
      );
    case 'welcome_back':
      return (
        <Shell
          kind={item.kind}
          icon="hand-wave-outline"
          eyebrow="Welcome back"
          title={`Welcome back, ${home.first_name}.`}
          detail="A fresh week starts today."
          onLater={later}
        >
          {item.level_id ? (
            <Primary
              label={PLAY_DAILY_LABEL}
              icon="target"
              onPress={() => router.push({ pathname: '/quest/daily/[level]', params: { level: item.level_id! } })}
            />
          ) : (
            <Primary label="Start a quest" icon="play" onPress={openNewQuestFromHome} />
          )}
        </Shell>
      );
    case 'practise_before':
      return (
        <Shell
          kind={item.kind}
          icon="target"
          eyebrow="Before your lesson"
          title={`Practise before ${lessonDayWords(item.lesson.occurs_on, home.day)}.`}
          detail={`Five questions at ${TILE_LEVEL_WORDS[item.level_id as QuestionBankLevelId] ?? levelLabel(item.level_id)}, warm-up for ${firstOf(item.lesson.tutor_name)}'s lesson${placeWords(item.lesson)}.`}
          onLater={later}
        >
          <Button
            testID="next-up-action"
            mode="contained"
            icon="target"
            disabled={pending}
            contentStyle={{ minHeight: 48 }}
            onPress={() => void start(practiseRequest(item.level_id))}
          >
            {pending ? 'Starting…' : 'Practise 5'}
          </Button>
        </Shell>
      );
    case 'focus_default':
      return item.focus === 'assessment' ? (
        <Shell kind={item.kind} icon="draw-pen" eyebrow="Assessments" title="Start an assessment." detail="Questions answered by hand, one page each.">
          <Primary label="Open Assessments" icon="draw-pen" onPress={go('/assessments')} />
        </Shell>
      ) : (
        <Shell kind={item.kind} icon="play" eyebrow="Quest" title="Start a quest." detail="Pick a level and go.">
          <Primary label="New quest" icon="play" onPress={openNewQuestFromHome} />
        </Shell>
      );
    case 'open_game':
      // Phase 73 (JF13): the game the reader is in, resumed where they are -- never a new one.
      return (
        <Shell kind={item.kind} icon="play" eyebrow="Pick up where you left off" title={item.game.title} onLater={later}>
          <Primary label="Continue" icon="play" onPress={() => openGameFromHome(item.game.game_id)} />
        </Shell>
      );
    case 'continue_quest':
      // Phase 73 (JF13): no game open -- the last one's settings, again, under their own name.
      return (
        <Shell kind={item.kind} icon="replay" eyebrow="Play again" title={`${item.title}.`} onLater={later}>
          <Button
            testID="next-up-action"
            mode="contained"
            icon="replay"
            disabled={pending || !again}
            contentStyle={{ minHeight: 48 }}
            onPress={() => again && void start(again.request)}
          >
            {pending ? 'Starting…' : 'Play again'}
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
          {/* Phase 74 (JF17): practice for it, where Quest is on -- secondary, so Next up keeps one heavy action. */}
          {next.practiceLevelId ? (
            <Button
              testID="next-up-practise"
              mode="outlined"
              icon="target"
              disabled={pending}
              contentStyle={{ minHeight: 48 }}
              onPress={() => void start(practiseRequest(next.practiceLevelId!))}
            >
              Practise for it
            </Button>
          ) : null}
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
        // Phase 74 (JF6): assessments submitted and waiting to be looked at are the office's too.
        o.assessments_open ? `${o.assessments_open} ${o.assessments_open === 1 ? 'assessment' : 'assessments'} to look at` : null,
      ].filter(Boolean);
      const onlyAssessments = !o.join_requests && !o.invitations;
      return (
        <Shell kind={item.kind} icon="account-plus-outline" eyebrow="Needs you" title={parts.join(' · ')} onLater={later}>
          {onlyAssessments ? (
            <Primary label="Open assessments" icon="clipboard-check-outline" onPress={go('/assessments')} />
          ) : (
            <Primary label="Open people" icon="account-group-outline" onPress={go('/people')} />
          )}
        </Shell>
      );
    }
  }
}
