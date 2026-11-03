import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CalendarClockIcon,
  CalendarXIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  PencilLineIcon,
  PlayIcon,
  TargetIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  START_LEAD_MINUTES,
  chooseNextUp,
  featureOn,
  lessonWhen,
  nextUpCandidates,
  nextUpKey,
  startsInWords,
  type MemberHome,
  type NextUp,
  type NextUpExtras,
  type SessionMode,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { guestLeadLevel } from '@/features/guest/guest-store';
import { useDaily } from '@/features/habit/habit-api';
import { WaitingForYou, useStartQuest } from '@/features/play/play-home';
import { readLastQuest, useMemberTiles, useWaitingGames } from '@/features/play/play-api';
import { useStartSession } from '@/features/teaching/api';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { putOff, readPutOff } from './api';

export interface RecordRequest {
  tutor_user_id: string;
  student_user_id: string;
  occurs_on: string;
  start_time: string;
  end_time: string;
  mode: SessionMode;
}

/** What only this device knows (H2): a game waiting, the last quest here, today's Daily. */
function useExtras(home: MemberHome | undefined): NextUpExtras & { dailyLevel: string | null } {
  const { organization } = useAuth();
  const learner = Boolean(home?.hats.includes('learner'));
  const quest = featureOn(organization, 'quest');
  const waiting = useWaitingGames(quest);
  const tiles = useMemberTiles(quest && learner);
  const last = learner ? readLastQuest(organization?.slug) : null;
  const list = tiles.data?.data.tiles ?? [];
  const lead = last?.request.level_id ?? guestLeadLevel();
  const dailyTile = list.find((tile) => tile.level_id === lead) ?? list[0];
  const dailyLevel = learner && tiles.data?.data.daily && dailyTile ? dailyTile.level_id : null;
  const daily = useDaily(dailyLevel);
  const game = waiting.data?.data[0];
  return {
    game_invite: game ? { game_id: game.game_id, title: 'game', host_first_name: game.host_first_name } : null,
    continue_quest: last ? { code: last.label, title: last.label } : null,
    daily: dailyLevel && daily.data ? { level_id: dailyLevel, done: daily.data.data.result !== null } : null,
    dailyLevel,
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
  }, [home, extras.game_invite?.game_id, extras.continue_quest?.code, extras.daily?.done, extras.daily?.level_id, later, organization?.slug]);
  return {
    item,
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
  detail?: string | null;
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
          <span className="text-muted-foreground text-xs font-bold tracking-wider uppercase">{eyebrow}</span>
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
  onLater,
  onRecord,
}: {
  home: MemberHome;
  item: NextUp | null;
  onLater: (item: NextUp) => void;
  onRecord: (lesson: RecordRequest) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const startSession = useStartSession();
  const { start, pending } = useStartQuest();
  const later = item ? () => onLater(item) : undefined;
  const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

  async function startLesson(studentId: string, mode: SessionMode) {
    try {
      await startSession.mutateAsync({ student_user_id: studentId, mode } as never);
      toast.success('Lesson started.');
      navigate('/sessions');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not start the lesson.');
    }
  }

  if (!item) {
    return (
      <Shell kind="none" icon={CheckCircle2Icon} eyebrow="Next up" title="You're all caught up." detail="Nothing needs you right now." />
    );
  }

  const primary = (label: string, onClick: () => void, Icon: LucideIcon = PlayIcon) => (
    <Button size="lg" className="rounded-full" onClick={onClick} data-testid="next-up-action">
      <Icon /> {label}
    </Button>
  );
  const link = (label: string, to: string, Icon: LucideIcon = PlayIcon) => (
    <Button asChild size="lg" className="rounded-full" data-testid="next-up-action">
      <Link to={to}>
        <Icon /> {label}
      </Link>
    </Button>
  );

  switch (item.kind) {
    case 'lesson_unrecorded': {
      const l = item.lesson;
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
          {primary('Record it now', () =>
            onRecord({ tutor_user_id: user!.id, student_user_id: l.student_user_id, occurs_on: l.occurs_on, start_time: l.start_time, end_time: l.end_time, mode: l.mode }),
            PencilLineIcon,
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
            ? primary(startSession.isPending ? 'Starting…' : 'Start lesson', () => void startLesson(l.student_user_id, l.mode))
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
          detail={c.next_lesson ? `Next: ${lessonWhen(c.next_lesson.occurs_on, c.next_lesson.start_time, home.day)} with ${firstName(c.next_lesson.tutor_name)}.` : null}
          onLater={later}
        >
          {link('See the schedule', '/schedule', CalendarClockIcon)}
        </Shell>
      );
    }
    case 'game_invite':
      return (
        <Shell kind={item.kind} icon={TargetIcon} eyebrow="Waiting for you" title={`${item.game.host_first_name} started a game.`} onLater={later}>
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
          {link('Open sessions', '/sessions', PencilLineIcon)}
        </Shell>
      );
    case 'daily':
      return (
        <Shell kind={item.kind} icon={TargetIcon} eyebrow="Today's 5" title="Five questions. Can you hit all five?" onLater={later}>
          {link("Play today's 5", `/quest/daily/${item.level_id}`, TargetIcon)}
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
          title={`${lessonWhen(item.lesson.occurs_on, item.lesson.start_time, home.day)[0]!.toUpperCase()}${lessonWhen(item.lesson.occurs_on, item.lesson.start_time, home.day).slice(1)} with ${firstName(item.lesson.tutor_name)}.`}
        >
          {link('See the schedule', '/schedule', CalendarClockIcon)}
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
          title={`${lessonWhen(l.occurs_on, l.start_time, home.day)[0]!.toUpperCase()}${lessonWhen(l.occurs_on, l.start_time, home.day).slice(1)} with ${firstName(l.tutor_name)}.`}
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
      ].filter(Boolean);
      return (
        <Shell kind={item.kind} icon={UserPlusIcon} eyebrow="Needs you" title={parts.join(' · ')} onLater={later}>
          {link('Open people', '/users', UserPlusIcon)}
        </Shell>
      );
    }
  }
}

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
  const { organization } = useAuth();
  const last = readLastQuest(organization?.slug);
  return (
    <Shell kind={item.kind} icon={PlayIcon} eyebrow="Pick up where you left off" title={`Continue ${item.title}.`} onLater={onLater}>
      <Button
        size="lg"
        className="rounded-full"
        disabled={pending || !last}
        onClick={() => last && void start(last.label, last.request)}
        data-testid="next-up-action"
      >
        <PlayIcon /> Continue
      </Button>
    </Shell>
  );
}
