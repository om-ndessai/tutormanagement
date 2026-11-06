import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClockIcon,
  CalendarXIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  PencilLineIcon,
  PlayIcon,
  SquareIcon,
  HandHeartIcon,
  TargetIcon,
  TrophyIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  DAILY_NAME,
  QUICK_ACTION_LABELS,
  START_LEAD_MINUTES,
  TILE_LEVEL_WORDS,
  chooseNextUp,
  dailyLevelFor,
  featureOn,
  lessonDayWords,
  lessonWhen,
  levelLabel,
  nextUpCandidates,
  nextUpKey,
  practiseRequest,
  startsInWords,
  type MemberHome,
  type NextUp,
  type NextUpExtras,
  type ActiveSession,
  type QuestionBankLevelId,
  SESSION_MODE_LABELS,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { useDaily, useHabit } from '@/features/habit/habit-api';
import { questRoles, useQuestState } from '@/features/quest/api';
import { useGoToGame, type PlayOriginState } from '@/features/quest/play-origin';
import { WaitingForYou, useStartQuest } from '@/features/play/play-home';
import { leadGradeOf, useMemberTiles, useOpenGame, useWaitingGames } from '@/features/play/play-api';
import { useActiveSession } from '@/features/teaching/api';
import { RunningFor, StopLessonFlow } from '@/features/teaching/live-session-bar';
import { DraftMark, type KnownLesson } from '@/features/teaching/record-lesson';
import { StartLessonDialog, type StartPreset } from '@/features/teaching/start-session-button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { putOff, readPutOff } from './api';
import { lessonLine } from './lesson-words';

/**
 * What the home's own read does not carry (H2): a game waiting, the open game (or "again"), today's Daily -- and,
 * since Phase 75 (JF30), the reader's lesson running now, from the live lesson's own read.
 */
function useExtras(home: MemberHome | undefined): NextUpExtras & { dailyLevel: string | null; active: ActiveSession | null } {
  const { organization, user } = useAuth();
  const learner = Boolean(home?.hats.includes('learner'));
  const quest = featureOn(organization, 'quest');
  const live = useActiveSession(featureOn(organization, 'tutoring') && Boolean(home?.hats.includes('tutor')));
  const active = live.data?.data.mine ?? null;
  const waiting = useWaitingGames(quest);
  const tiles = useMemberTiles(quest && learner);
  // Phase 73 (JF13): Continue is the server's -- the open game, else the last one's settings again.
  const open = useOpenGame(quest && learner);
  const list = tiles.data?.data.tiles ?? [];
  // Phase 73 (JF14, JF23): ONE Daily rule, the board's: the lead grade's first card's level.
  const ruled = dailyLevelFor(list, leadGradeOf(tiles.data?.data));
  const dailyLevel = learner && tiles.data?.data.daily ? ruled : null;
  const daily = useDaily(dailyLevel);
  const openGame = learner ? (open.data?.data.open ?? null) : null;
  const again = learner ? (open.data?.data.again ?? null) : null;
  const game = waiting.data?.data[0];
  // Phase 67: a student's Question Quest with a question waiting is a Next up item (it was a redirect).
  const roles = questRoles(user?.roles);
  const questStudent = Boolean(organization?.gamify_question_quest) && roles.plays && !roles.reviews;
  const questState = useQuestState(questStudent);
  const habit = useHabit(quest && learner);
  return {
    question_quest: questStudent && questState.data?.data.question ? { level_id: questState.data.data.level_id } : null,
    welcome_back: habit.data?.data.welcome_back ?? false,
    game_invite: game ? { game_id: game.game_id, title: 'game', host_first_name: game.host_first_name } : null,
    open_game: openGame ? { game_id: openGame.game_id, title: openGame.label } : null,
    continue_quest: again ? { code: again.label, title: again.label } : null,
    daily: dailyLevel && daily.data ? { level_id: dailyLevel, done: daily.data.data.result !== null } : null,
    // Phase 68 (H10): practice before a lesson starts at the board's lead level.
    practice_level_id: learner && quest ? ruled : null,
    played_today: habit.data?.data.played_today ?? false,
    running: active ? { student_name: active.student_name, started_at: active.started_at, mode: active.mode } : null,
    dailyLevel,
    active,
  };
}

/** The one Next up (H2) and what it needs to act. */
export function useNextUp(home: MemberHome | undefined) {
  const { organization } = useAuth();
  const extras = useExtras(home);
  const [later, setLater] = useState(0);
  const item = useMemo(() => {
    if (!home) return null;
    void later;
    return chooseNextUp(nextUpCandidates(home, extras), readPutOff(organization?.slug, home.day));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, extras.running?.started_at, extras.game_invite?.game_id, extras.open_game?.game_id, extras.open_game?.title, extras.continue_quest?.code, extras.daily?.done, extras.daily?.level_id, extras.question_quest?.level_id, Boolean(extras.question_quest), extras.welcome_back, extras.practice_level_id, extras.played_today, later, organization?.slug]);
  return {
    item,
    /** Phase 75 (JF30): the running lesson itself, for Stop. */
    active: extras.active,
    /** Phase 74 (JF17): the level a learner's practice starts at, where Quest is on (the board's lead). */
    practiceLevel: extras.practice_level_id ?? null,
    putOff(next: NextUp) {
      if (!home) return;
      putOff(organization?.slug, home.day, nextUpKey(next));
      setLater((n) => n + 1);
    },
  };
}

function Shell({
  kind,
  icon: Icon,
  eyebrow,
  title,
  detail,
  children,
  onLater,
  tone = 'default',
}: {
  kind: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail?: React.ReactNode;
  children?: React.ReactNode;
  onLater?: () => void;
  tone?: 'default' | 'celebrate';
}) {
  return (
    <section
      aria-label="Next up"
      data-testid="next-up"
      data-tour="home-next-up"
      className={cn(
        'bg-card text-card-foreground relative grid gap-3 rounded-3xl border p-5 shadow-[var(--elevation-2)]',
        tone === 'celebrate' && 'border-success/40',
      )}
    >
      <div className="flex items-start gap-3" data-testid={`next-up-${kind}`}>
        <span
          className={cn(
            'grid size-11 flex-none place-items-center rounded-2xl',
            tone === 'celebrate' ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="grid min-w-0 gap-1">
          <span className="text-muted-foreground text-[13px] font-bold">{eyebrow}</span>
          <h2 className="font-display text-xl leading-tight font-black sm:text-2xl">{title}</h2>
          {detail && <p className="text-muted-foreground text-sm">{detail}</p>}
        </div>
      </div>
      {(children || onLater) && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {onLater && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onLater} data-testid="next-up-later">
              Later
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

export function NextUpCard({
  home,
  item,
  active = null,
  onLater,
  onRecord,
  practiceLevel = null,
}: {
  home: MemberHome;
  item: NextUp | null;
  /** The reader's running lesson (Phase 75), for Stop. */
  active?: ActiveSession | null;
  onLater: (item: NextUp) => void;
  /** A known lesson to record: "Record a lesson", or its draft (Phase 75, JF19, JF30). */
  onRecord: (lesson: KnownLesson) => void;
  /** Where Quest is on, the level a learner's practice for their lesson starts at. */
  practiceLevel?: string | null;
}) {
  // Start and Stop open in place (Phase 75, JF30), held here so they outlive the item that opened them.
  const [starting, setStarting] = useState<StartPreset | null>(null);
  const [stopping, setStopping] = useState<ActiveSession | null>(null);
  return (
    <>
      <NextUpBody
        home={home}
        item={item}
        active={active}
        onLater={onLater}
        onRecord={onRecord}
        onStart={setStarting}
        onStop={setStopping}
        practiceLevel={practiceLevel}
      />
      {/* Mounted only while asked for: a learner's home reads nothing of a tutor's. */}
      {starting && <StartLessonDialog open onOpenChange={(open) => !open && setStarting(null)} preset={starting} />}
      {stopping && <StopLessonFlow active={stopping} onClose={() => setStopping(null)} />}
    </>
  );
}

function NextUpBody({
  home,
  item,
  active,
  onLater,
  onRecord,
  onStart,
  onStop,
  practiceLevel,
}: {
  home: MemberHome;
  item: NextUp | null;
  active: ActiveSession | null;
  onLater: (item: NextUp) => void;
  onRecord: (lesson: KnownLesson) => void;
  onStart: (preset: StartPreset) => void;
  onStop: (active: ActiveSession) => void;
  practiceLevel: string | null;
}) {
  const { user } = useAuth();
  const { start, pending } = useStartQuest();
  const goToGame = useGoToGame();
  const later = item ? () => onLater(item) : undefined;
  const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

  if (!item) {
    // The office's own section says "Nothing needs you right now" (JF6): not twice.
    return (
      <Shell
        kind="none"
        icon={CheckCircle2Icon}
        eyebrow="Next up"
        title="You're all caught up."
        detail={home.hats.includes('office') ? null : 'Nothing needs you right now.'}
      />
    );
  }

  const primary = (label: string, onClick: () => void, Icon: LucideIcon = PlayIcon) => (
    <Button size="lg" className="rounded-full" onClick={onClick} data-testid="next-up-action">
      <Icon /> {label}
    </Button>
  );
  const link = (label: string, to: string, Icon: LucideIcon = PlayIcon) => (
    <Button asChild size="lg" className="rounded-full" data-testid="next-up-action">
      {/* A full-screen Quest page goes back here (JF36). */}
      <Link to={to} state={to.startsWith('/quest/') ? ({ from: '/' } satisfies PlayOriginState) : undefined}>
        <Icon /> {label}
      </Link>
    </Button>
  );

  switch (item.kind) {
    case 'lesson_running': {
      const r = item.running;
      return (
        <Shell
          kind={item.kind}
          icon={PlayIcon}
          eyebrow="Lesson under way"
          title={`Your lesson with ${firstName(r.student_name)} is running.`}
          detail={
            <>
              Running <RunningFor startedAt={r.started_at} /> · {SESSION_MODE_LABELS[r.mode]}
            </>
          }
        >
          {primary('Stop', () => active && onStop(active), SquareIcon)}
        </Shell>
      );
    }
    case 'lesson_unrecorded': {
      const l = item.lesson;
      const lesson: KnownLesson = {
        tutor_user_id: user!.id,
        student_user_id: l.student_user_id,
        student_name: l.student_name,
        occurs_on: l.occurs_on,
        start_time: l.start_time,
        end_time: l.end_time,
        mode: l.mode,
        place: l.place ? { name: l.place.name, kind: l.place.kind } : null,
        draft: l.draft ?? null,
      };
      return (
        <Shell
          kind={item.kind}
          tone="celebrate"
          icon={PencilLineIcon}
          eyebrow="Lesson finished"
          title={`You finished a lesson with ${firstName(l.student_name)}.`}
          detail={`${lessonWhen(l.occurs_on, l.start_time, home.day)} · not recorded yet`}
          onLater={later}
        >
          {/* Its draft, when the reader has begun one (JF19): continued, never a second. */}
          {l.draft ? (
            <DraftMark draft={l.draft} size="lg" onContinue={() => onRecord(lesson)} testId="next-up-draft" />
          ) : (
            primary('Record it now', () => onRecord(lesson), PencilLineIcon)
          )}
        </Shell>
      );
    }
    case 'lesson_now':
    case 'lesson_next': {
      const l = item.lesson;
      const soon = item.starts_in !== null && item.starts_in <= START_LEAD_MINUTES;
      return (
        <Shell
          kind={item.kind}
          icon={CalendarClockIcon}
          eyebrow={soon ? 'Lesson' : 'Next lesson'}
          title={
            soon
              ? `${firstName(l.student_name)}'s lesson ${item.starts_in! <= 0 ? 'is under way' : `starts ${startsInWords(item.starts_in!)}`}.`
              : `${firstName(l.student_name)}, ${lessonWhen(l.occurs_on, l.start_time, home.day)}.`
          }
          detail={l.place ? (l.place.kind === 'virtual' ? 'Online' : l.place.name) : null}
          onLater={soon ? later : undefined}
        >
          {soon
            ? primary('Start lesson', () => onStart({ student_user_id: l.student_user_id, mode: l.mode }))
            : link('See the schedule', '/schedule', CalendarClockIcon)}
        </Shell>
      );
    }
    case 'child_change': {
      const c = item.child;
      return (
        <Shell
          kind={item.kind}
          icon={CalendarXIcon}
          eyebrow="A change"
          title={`${c.first_name}'s lesson ${lessonWhen(c.cancelled!.occurs_on, c.cancelled!.start_time, home.day)} is cancelled.`}
          detail={c.next_lesson ? `Next: ${lessonLine(c.next_lesson, home.day)}.` : null}
          onLater={later}
        >
          {link('See the schedule', '/schedule', CalendarClockIcon)}
        </Shell>
      );
    }
    case 'open_game':
      return (
        <Shell kind={item.kind} icon={PlayIcon} eyebrow="Pick up where you left off" title={item.game.title} onLater={later}>
          {primary('Continue', () => goToGame(item.game.game_id))}
        </Shell>
      );
    case 'game_invite':
      return (
        <Shell kind={item.kind} icon={TargetIcon} eyebrow="Waiting for you" title={`${item.game.host_first_name} started a quest.`} onLater={later}>
          <div className="w-full">
            <WaitingForYou />
          </div>
        </Shell>
      );
    case 'reviews_waiting': {
      const parts = [
        item.assessments ? `${item.assessments} ${item.assessments === 1 ? 'assessment' : 'assessments'}` : null,
        item.quest ? `${item.quest} ${item.quest === 1 ? 'answer' : 'answers'}` : null,
      ].filter(Boolean);
      return (
        <Shell kind={item.kind} icon={ClipboardCheckIcon} eyebrow="To review" title={`${parts.join(' and ')} to review.`} onLater={later}>
          {item.assessments > 0 && link('Review assessments', '/assessments', ClipboardCheckIcon)}
          {item.quest > 0 && (
            <Button asChild size="lg" variant={item.assessments > 0 ? 'outline' : 'default'} className="rounded-full">
              <Link to="/quest/review">Review answers</Link>
            </Button>
          )}
        </Shell>
      );
    }
    case 'assessment_continue':
      return (
        <Shell kind={item.kind} icon={PencilLineIcon} eyebrow="Your assessment" title="Your assessment is waiting for you." detail="Pick up where you left off." onLater={later}>
          {link('Continue', `/assessments/${item.assessment.id}`)}
        </Shell>
      );
    case 'office_to_record':
      return (
        <Shell
          kind={item.kind}
          icon={PencilLineIcon}
          eyebrow="Needs you"
          title={`${item.office.to_record_count} ${item.office.to_record_count === 1 ? 'lesson' : 'lessons'} of the last 7 days not recorded.`}
          detail={item.office.to_record[0] ? `Latest: ${firstName(item.office.to_record[0].student_name)} with ${firstName(item.office.to_record[0].tutor_name)}, ${lessonWhen(item.office.to_record[0].occurs_on, item.office.to_record[0].start_time, home.day)}.` : null}
          onLater={later}
        >
          {link('See the lessons', '/sessions', PencilLineIcon)}
        </Shell>
      );
    case 'daily':
      return (
        <Shell
          kind={item.kind}
          icon={TargetIcon}
          eyebrow={DAILY_NAME}
          title="Five questions. Can you hit all five?"
          detail={TILE_LEVEL_WORDS[item.level_id as QuestionBankLevelId] ?? levelLabel(item.level_id as QuestionBankLevelId)}
          onLater={later}
        >
          {link(`Play ${DAILY_NAME.replace(/^T/, 't')}`, `/quest/daily/${item.level_id}`, TargetIcon)}
        </Shell>
      );
    case 'question_quest':
      return (
        <Shell
          kind={item.kind}
          icon={TrophyIcon}
          eyebrow="Your Quest"
          title="Your Quest has a question waiting."
          detail={item.level_id ? `${levelLabel(item.level_id as QuestionBankLevelId)} · one question at a time.` : null}
          onLater={later}
        >
          {link('Open Quest', '/quest/play', TrophyIcon)}
        </Shell>
      );
    case 'welcome_back':
      return (
        <Shell
          kind={item.kind}
          icon={HandHeartIcon}
          eyebrow="Welcome back"
          title={`Welcome back, ${home.first_name}.`}
          detail="A fresh week starts today."
          onLater={later}
        >
          {item.level_id
            ? link(`Play ${DAILY_NAME.replace(/^T/, 't')}`, `/quest/daily/${item.level_id}`, TargetIcon)
            : link('Start a quest', '/quest/games/new', PlayIcon)}
        </Shell>
      );
    case 'practise_before':
      return (
        <Shell
          kind={item.kind}
          icon={TargetIcon}
          eyebrow="Before your lesson"
          title={`Practise before ${lessonDayWords(item.lesson.occurs_on, home.day)}.`}
          detail={`${lessonLine(item.lesson, home.day, { capitalise: true })}. Five questions at ${TILE_LEVEL_WORDS[item.level_id as QuestionBankLevelId] ?? levelLabel(item.level_id as QuestionBankLevelId)} to warm up.`}
          onLater={later}
        >
          {primary(pending ? 'Starting…' : 'Practise 5', () => void start(practiseRequest(item.level_id)), TargetIcon)}
        </Shell>
      );
    case 'focus_default':
      return item.focus === 'assessment' ? (
        <Shell kind={item.kind} icon={PencilLineIcon} eyebrow="Assessments" title="Start an assessment." detail="Questions answered by hand, one page each.">
          {link('Open Assessments', '/assessments', PencilLineIcon)}
        </Shell>
      ) : (
        <Shell kind={item.kind} icon={PlayIcon} eyebrow="Quest" title="Start a quest." detail="Pick a level and go.">
          {link(QUICK_ACTION_LABELS.new_quest, '/quest/games/new', PlayIcon)}
        </Shell>
      );
    case 'continue_quest':
      return <ContinueQuest item={item} pending={pending} start={start} onLater={later} />;
    case 'learner_lesson':
      return (
        <Shell
          kind={item.kind}
          icon={CalendarClockIcon}
          eyebrow="Your next lesson"
          title={`${lessonLine(item.lesson, home.day, { capitalise: true })}.`}
        >
          {link('See the schedule', '/schedule', CalendarClockIcon)}
          {/* Phase 74 (JF17): the lesson leads to practice for it, where Quest is on. */}
          {practiceLevel && (
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              disabled={pending}
              onClick={() => void start(practiseRequest(practiceLevel))}
              data-testid="next-up-practise"
            >
              <TargetIcon /> {pending ? 'Starting…' : 'Practise for it'}
            </Button>
          )}
        </Shell>
      );
    case 'child_next_lesson': {
      const c = item.child;
      const l = c.next_lesson!;
      return (
        <Shell
          kind={item.kind}
          icon={CalendarClockIcon}
          eyebrow={`${c.first_name}'s next lesson`}
          title={`${lessonLine(l, home.day, { capitalise: true })}.`}
          detail={c.homework ? `Homework: ${c.homework}` : null}
        >
          {link('See the schedule', '/schedule', CalendarClockIcon)}
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
        <Shell kind={item.kind} icon={UserPlusIcon} eyebrow="Needs you" title={parts.join(' · ')} onLater={later}>
          {onlyAssessments ? link('Open assessments', '/assessments', UserPlusIcon) : link('Open people', '/users', UserPlusIcon)}
        </Shell>
      );
    }
  }
}

/** Phase 73 (JF13): with no game open, the last one's settings under their own name -- "Play Grade 7 Quick 5 again". */
function ContinueQuest({
  item,
  pending,
  start,
  onLater,
}: {
  item: Extract<NextUp, { kind: 'continue_quest' }>;
  pending: boolean;
  start: ReturnType<typeof useStartQuest>['start'];
  onLater?: () => void;
}) {
  const open = useOpenGame();
  const again = open.data?.data.again ?? null;
  return (
    <Shell kind={item.kind} icon={PlayIcon} eyebrow="Play again" title={`${item.title}.`} onLater={onLater}>
      <Button
        size="lg"
        className="rounded-full"
        disabled={pending || !again}
        onClick={() => again && void start(again.request)}
        data-testid="next-up-action"
      >
        <PlayIcon /> Play again
      </Button>
    </Shell>
  );
}
