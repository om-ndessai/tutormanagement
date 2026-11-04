import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3Icon,
  HomeIcon,
  UsersIcon,
  CalendarDaysIcon,
  ClipboardCheckIcon,
  CompassIcon,
  KeyRoundIcon,
  Loader2Icon,
  PencilLineIcon,
  PenLineIcon,
  PlayIcon,
  PlusIcon,
  TrendingUpIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  HOME_FOCUS_LABELS,
  HOME_HAT_LABELS,
  STREAK_DAYS_PER_WEEK,
  featureOn,
  tourOffered,
  homeGreeting,
  lessonWhen,
  lessonDayWords,
  orderHats,
  playWithRequest,
  practiseBefore,
  quickActionsFor,
  startsInWords,
  type HomeChild,
  type HomeFocus,
  type HomeHat,
  type HomeOffice,
  type HomeTutor,
  type MemberHome,
  type NextUp,
  type QuickAction,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AssessmentSection } from '@/features/dashboard/assessment-home';
import { useHabit } from '@/features/habit/habit-api';
import { LessonReminderSheet } from '@/features/locations/lesson-reminder';
import { useOnboarding } from '@/features/onboarding/onboarding-provider';
import { PlayFavorites, PlayHome, WaitingForYou, useStartQuest } from '@/features/play/play-home';
import { useMemberTiles } from '@/features/play/play-api';
import { SessionFormDialog } from '@/features/teaching/session-form-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useMemberHome, usePinHome } from './api';
import { NextUpCard, useNextUp, type RecordRequest } from './next-up';

const firstName = (name: string) => name.split(/\s+/)[0] ?? name;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capital = (text: string) => (text ? `${text[0]!.toUpperCase()}${text.slice(1)}` : text);

/**
 * Phase 66 (docs/member-home-plan.md H1-H4, H9): one home for every member. The band (the guest
 * home's, slimmer), ONE Next up card, quick actions, and a section per hat -- those with something
 * today first. No money: the role dashboards, with their Finance tab, are at /dashboard.
 */
export function MemberHomePage() {
  const { organization } = useAuth();
  const query = useMemberHome();
  const home = query.data?.data;
  const { item, putOff } = useNextUp(home);
  const [record, setRecord] = useState<{ open: boolean; lesson: RecordRequest | null }>({ open: false, lesson: null });

  if (!home) {
    return (
      <div className="mx-auto max-w-6xl py-16" data-testid="member-home-loading">
        {query.isError ? (
          <p className="text-destructive text-sm">Your home could not be loaded.</p>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 animate-spin" /> Loading your home…
          </p>
        )}
      </div>
    );
  }

  const hats = orderHats(home);
  const tutoring = featureOn(organization, 'tutoring');
  const quest = featureOn(organization, 'quest');
  const assessment = featureOn(organization, 'assessment');
  const actions = quickActionsFor(hats, { tutoring, quest, assessment, mayBringPeople: home.may_bring_people });

  return (
    <div className="mx-auto grid max-w-6xl gap-6" data-testid="member-home">
      {tutoring && <LessonReminderSheet />}
      <div className="relative">
        <Band home={home} hat={hats[0] ?? null} />
        <div className="relative -mt-12 px-3 sm:px-6">
          <NextUpCard
            home={home}
            item={item}
            onLater={(next: NextUp) => putOff(next)}
            onRecord={(lesson) => setRecord({ open: true, lesson })}
          />
        </div>
      </div>

      {actions.length > 0 && (
        <QuickActions actions={actions} onRecord={() => setRecord({ open: true, lesson: null })} />
      )}

      {hats.map((hat) => (
        <HatSection key={hat} hat={hat} home={home} nextUp={item} onRecord={(lesson) => setRecord({ open: true, lesson })} />
      ))}

      {/* Where Quest is on, a member who does not wear the learner hat keeps their favorites in one tap. */}
      {quest && !hats.includes('learner') && (
        <section className="grid gap-3 empty:hidden" data-testid="home-play-row">
          <PlayFavorites compact />
          {item?.kind !== 'game_invite' && <WaitingForYou />}
        </section>
      )}

      {(home.focus_options?.length ?? 0) > 1 && <PinHome home={home} />}

      {tutoring && (
        <SessionFormDialog
          open={record.open}
          onOpenChange={(open) => setRecord((now) => ({ ...now, open }))}
          existing={null}
          fromSchedule={record.lesson}
          showMoney={false}
        />
      )}
    </div>
  );
}

/** The guest home's band, slimmer: the greeting, the space, and one line for the hat that leads. */
function Band({ home, hat }: { home: MemberHome; hat: HomeHat | null }) {
  const brand = useBrand();
  const { organization } = useAuth();
  const habit = useHabit(hat === 'learner' && featureOn(organization, 'quest'));
  const { openWizard } = useOnboarding();
  return (
    <div
      className="from-brand-900 to-brand-800 relative overflow-hidden rounded-3xl bg-gradient-to-br px-5 pt-5 pb-16 text-white sm:px-8"
      data-testid="home-band"
      data-tour="home-band"
    >
      <Rings />
      <div className="relative grid gap-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-white/75">
          {brand.short}
          {/* Phase 26: the welcome wizard and tour, on demand -- where Tutoring is on (owner, 2026-11-04). */}
          {tourOffered(organization) && (
            <button
              type="button"
              onClick={openWizard}
              data-tour="getting-started"
              data-testid="home-getting-started"
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border border-white/50 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10"
            >
              <CompassIcon className="size-3.5" aria-hidden /> Getting started
            </button>
          )}
        </span>
        <h1 className="font-display text-3xl leading-tight font-black sm:text-4xl" data-testid="home-greeting">
          {homeGreeting(home)}
        </h1>
        <p className="text-[15px] text-white/85" data-testid="home-strip">
          {stripLine(home, hat, habit.data?.data.days_this_week ?? null)}
        </p>
      </div>
    </div>
  );
}

function stripLine(home: MemberHome, hat: HomeHat | null, daysThisWeek: number | null): string {
  switch (hat) {
    case 'tutor': {
      const t = home.tutor!;
      return [`Today: ${plural(t.lessons_today, 'lesson')}`, t.to_record_count ? `${t.to_record_count} to record` : null]
        .filter(Boolean)
        .join(' · ');
    }
    case 'office': {
      const o = home.office!;
      const parts = [
        o.to_record_count ? `${o.to_record_count} to record` : null,
        o.invitations ? `${o.invitations} invited` : null,
        o.join_requests ? `${o.join_requests} asking to join` : null,
      ].filter(Boolean);
      return parts.length ? parts.join(' · ') : `All caught up · ${plural(o.lessons_this_week, 'lesson')} this week`;
    }
    case 'parent': {
      const child = home.parent!.children[0];
      if (!child) return 'Your children';
      return child.next_lesson
        ? `${child.first_name}: next lesson ${lessonWhen(child.next_lesson.occurs_on, child.next_lesson.start_time, home.day)}`
        : `${child.first_name}: no lessons scheduled`;
    }
    case 'learner': {
      const next = home.learner!.next_lesson;
      if (next) return `Next lesson ${lessonWhen(next.occurs_on, next.start_time, home.day)}`;
      if (daysThisWeek !== null) return `${daysThisWeek} of ${STREAK_DAYS_PER_WEEK} days played this week`;
      return 'Ready when you are.';
    }
    default:
      return 'Welcome.';
  }
}

/** The bullseye's rings, faint, in the band's corner (as on the guest home). */
function Rings() {
  return (
    <svg aria-hidden className="absolute -top-20 -right-16 size-64 text-white/[0.07] sm:size-80" viewBox="0 0 200 200" fill="none">
      {[96, 72, 48, 24].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} stroke="currentColor" strokeWidth="14" />
      ))}
    </svg>
  );
}

const QUICK: Record<QuickAction, { label: string; icon: LucideIcon; to?: string }> = {
  record_lesson: { label: 'Record a lesson', icon: PencilLineIcon },
  start_lesson: { label: 'Start a lesson', icon: PlayIcon, to: '/sessions' },
  new_quest: { label: 'New quest', icon: PlusIcon, to: '/quest/games/new' },
  join_code: { label: 'Have a code?', icon: KeyRoundIcon },
  start_assessment: { label: 'Start an assessment', icon: ClipboardCheckIcon, to: '/assessments' },
  add_person: { label: 'Add a person', icon: UserPlusIcon, to: '/users' },
  schedule: { label: 'Schedule', icon: CalendarDaysIcon, to: '/schedule' },
  progress: { label: 'Progress', icon: TrendingUpIcon, to: '/progress' },
};

function QuickActions({ actions, onRecord }: { actions: QuickAction[]; onRecord: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" data-testid="home-quick-actions">
      {actions.map((action) => {
        const { label, icon: Icon, to } = QUICK[action];
        const onClick = () => {
          if (action === 'record_lesson') onRecord();
          else if (action === 'join_code') {
            const box = document.getElementById('play-code');
            box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            box?.focus();
          } else if (to) navigate(to);
        };
        return (
          <Button
            key={action}
            variant="secondary"
            className="h-auto flex-col gap-1 rounded-2xl py-3 text-xs sm:h-10 sm:flex-row sm:rounded-full sm:px-4 sm:text-sm"
            onClick={onClick}
            data-testid={`quick-${action}`}
          >
            <Icon className="size-5 sm:size-4" />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function SectionShell({ hat, children, aside }: { hat: HomeHat; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="grid gap-3" data-testid={`home-section-${hat}`} data-tour={`home-section-${hat}`} aria-labelledby={`home-${hat}-heading`}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 id={`home-${hat}-heading`} className="font-display text-xl font-semibold">
          {HOME_HAT_LABELS[hat]}
        </h2>
        {aside && <span className="text-muted-foreground ml-auto text-sm">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function HatSection({
  hat,
  home,
  nextUp,
  onRecord,
}: {
  hat: HomeHat;
  home: MemberHome;
  nextUp: NextUp | null;
  onRecord: (lesson: RecordRequest) => void;
}) {
  switch (hat) {
    case 'tutor':
      return <TutorSection home={home} tutor={home.tutor!} nextUp={nextUp} onRecord={onRecord} />;
    case 'office':
      return <OfficeSection home={home} office={home.office!} />;
    case 'parent':
      // A child's card is their lessons; where there is no Tutoring their assessments are under
      // Practice (Phase 68 adds what they played).
      return <ParentSection home={home} kids={home.parent!.children} />;
    case 'learner':
      return <LearnerSection home={home} hideWaiting={nextUp?.kind === 'game_invite'} nextShown={nextUp?.kind === 'learner_lesson'} />;
  }
}

function TutorSection({
  home,
  tutor,
  nextUp,
  onRecord,
}: {
  home: MemberHome;
  tutor: HomeTutor;
  nextUp: NextUp | null;
  onRecord: (lesson: RecordRequest) => void;
}) {
  const { user } = useAuth();
  const next = tutor.now.next;
  const nextShown = nextUp && (nextUp.kind === 'lesson_now' || nextUp.kind === 'lesson_next');
  return (
    <SectionShell hat="tutor" aside={`This week: ${plural(tutor.lessons_this_week, 'lesson')}`}>
      {next && !nextShown && (
        <Card className="py-0" data-testid="home-tutor-next">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <CalendarDaysIcon className="text-primary size-5" aria-hidden />
            <span className="min-w-0 flex-1">
              Next: <span className="font-medium">{next.student_name}</span>,{' '}
              {lessonWhen(next.occurs_on, next.start_time, home.day)}
              {tutor.next_starts_in !== null && tutor.next_starts_in < 24 * 60 && ` (${startsInWords(tutor.next_starts_in)})`}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link to="/schedule">Schedule</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="py-0" data-testid="home-to-record" data-tour="home-to-record">
        <CardContent className="grid gap-2 p-4 text-sm">
          <p className="font-medium">To record</p>
          {tutor.to_record.length === 0 ? (
            <p className="text-muted-foreground">Every lesson of the last week is recorded. Nice work.</p>
          ) : (
            <ul className="grid gap-2">
              {tutor.to_record.map((lesson) => (
                <li
                  key={`${lesson.schedule_id}-${lesson.occurs_on}`}
                  className="flex flex-wrap items-center gap-2"
                  data-testid={`home-to-record-${lesson.schedule_id}-${lesson.occurs_on}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{lesson.student_name}</span>{' '}
                    <span className="text-muted-foreground">· {capital(lessonWhen(lesson.occurs_on, lesson.start_time, home.day))}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      onRecord({
                        tutor_user_id: user!.id,
                        student_user_id: lesson.student_user_id,
                        occurs_on: lesson.occurs_on,
                        start_time: lesson.start_time,
                        end_time: lesson.end_time,
                        mode: lesson.mode,
                      })
                    }
                    data-testid={`home-record-${lesson.schedule_id}-${lesson.occurs_on}`}
                  >
                    <PencilLineIcon /> Record
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {tutor.to_record_count > tutor.to_record.length && (
            <Link to="/sessions" className="text-primary text-sm font-medium">
              +{tutor.to_record_count - tutor.to_record.length} more on the Sessions page
            </Link>
          )}
        </CardContent>
      </Card>

      {tutor.reviews.assessments + tutor.reviews.quest > 0 && (
        <div className="flex flex-wrap gap-2 text-sm" data-testid="home-tutor-reviews">
          {tutor.reviews.assessments > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link to="/assessments">{plural(tutor.reviews.assessments, 'assessment')} to review</Link>
            </Button>
          )}
          {tutor.reviews.quest > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link to="/quest/review">{plural(tutor.reviews.quest, 'answer')} to review</Link>
            </Button>
          )}
        </div>
      )}
    </SectionShell>
  );
}

function OfficeSection({ home, office }: { home: MemberHome; office: HomeOffice }) {
  const { organization } = useAuth();
  const tutoring = featureOn(organization, 'tutoring');
  const rows: { id: string; label: string; to: string; count: number }[] = [
    ...(tutoring ? [{ id: 'to-record', label: 'lessons not recorded (last 7 days)', to: '/sessions', count: office.to_record_count }] : []),
    { id: 'invitations', label: 'invitations not yet accepted', to: '/users', count: office.invitations },
    { id: 'requests', label: 'asking to join', to: '/users', count: office.join_requests },
  ];
  // Where there is no Tutoring and nothing waits, there is nothing to show.
  if (!tutoring && office.invitations + office.join_requests === 0) return null;
  return (
    <SectionShell hat="office" aside={tutoring ? `Today: ${plural(office.lessons_today, 'lesson')} · this week: ${office.lessons_this_week}` : undefined}>
      <Card className="py-0">
        <CardContent className="grid gap-2 p-4 text-sm">
          {rows.map((row) => (
            <Link
              key={row.id}
              to={row.to}
              className={cn('hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-1.5', row.count === 0 && 'text-muted-foreground')}
              data-testid={`home-office-${row.id}`}
            >
              <span className={cn('font-display w-8 text-right text-lg font-bold', row.count > 0 && 'text-primary')}>{row.count}</span>
              <span>{row.label}</span>
            </Link>
          ))}
          {office.to_record.length > 0 && (
            <ul className="text-muted-foreground grid gap-1 border-t pt-2 text-xs">
              {office.to_record.map((l) => (
                <li key={`${l.occurs_on}-${l.start_time}-${l.student_name}`}>
                  {capital(lessonWhen(l.occurs_on, l.start_time, home.day))} · {firstName(l.student_name)} with {firstName(l.tutor_name)}
                </li>
              ))}
            </ul>
          )}
          {tutoring && (
            <div className="pt-1">
              <Button asChild size="sm" variant="outline" data-testid="home-dashboard-link">
                <Link to="/dashboard">
                  <BarChart3Icon /> Open the dashboard
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </SectionShell>
  );
}

function ParentSection({ home, kids }: { home: MemberHome; kids: HomeChild[] }) {
  const { organization } = useAuth();
  const tutoring = featureOn(organization, 'tutoring');
  const quest = featureOn(organization, 'quest');
  const assessment = featureOn(organization, 'assessment');
  // Phase 68 (H10): "Play with <child>" starts at the child's last level, else this space's first tile.
  const tiles = useMemberTiles(quest && kids.length > 0);
  const firstTileLevel = tiles.data?.data.tiles[0]?.level_id ?? null;
  const { start, pending } = useStartQuest();
  return (
    <SectionShell hat="parent">
      {kids.length === 0 && (
        <Card className="py-0" data-testid="home-children-empty">
          <CardContent className="text-muted-foreground p-4 text-sm">
            No children here yet. Once the space adds your child, their lessons and homework show here.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 empty:hidden sm:grid-cols-2">
        {kids.map((child) => (
          <Card key={child.student_user_id} className="py-0" data-testid={`home-child-${child.student_user_id}`}>
            <CardContent className="grid gap-2 p-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary font-display grid size-10 place-items-center rounded-full text-lg font-bold">
                  {child.first_name[0]}
                </span>
                <span className="font-display text-lg font-semibold">{child.first_name}</span>
                {tutoring && (
                  <span className="text-muted-foreground ml-auto text-xs">{plural(child.lessons_this_month, 'lesson')} this month</span>
                )}
              </div>
              {tutoring && (
                <p data-testid={`home-child-next-${child.student_user_id}`}>
                  {child.next_lesson ? (
                    <>
                      Next lesson <span className="font-medium">{lessonWhen(child.next_lesson.occurs_on, child.next_lesson.start_time, home.day)}</span>{' '}
                      with {firstName(child.next_lesson.tutor_name)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">No lessons scheduled.</span>
                  )}
                </p>
              )}
              {child.cancelled && (
                <p className="text-destructive text-xs">
                  Cancelled: {lessonWhen(child.cancelled.occurs_on, child.cancelled.start_time, home.day)} with {child.cancelled.tutor_name}
                </p>
              )}
              {child.homework && (
                <p className="text-muted-foreground line-clamp-2 text-xs">
                  <span className="text-foreground font-medium">Homework:</span> {child.homework}
                </p>
              )}
              {quest && child.days_played_this_week != null && (
                <p className="text-muted-foreground text-xs" data-testid={`home-child-played-${child.student_user_id}`}>
                  Played {plural(child.days_played_this_week, 'day')} this week (aim: {STREAK_DAYS_PER_WEEK})
                  {child.daily_done_today ? " · today's Daily done" : ''}
                </p>
              )}
              <div className="flex flex-wrap gap-2 empty:hidden">
                {quest && (child.play_level_id ?? firstTileLevel) && (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      void start(`With ${child.first_name}`, playWithRequest((child.play_level_id ?? firstTileLevel)!, child.student_user_id))
                    }
                    data-testid={`home-child-play-${child.student_user_id}`}
                  >
                    <UsersIcon />
                    {practiseBefore(child.next_lesson, home.day)
                      ? `Practise together before ${lessonDayWords(child.next_lesson!.occurs_on, home.day)}`
                      : `Play with ${child.first_name}`}
                  </Button>
                )}
                {tutoring && (
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/progress/${child.student_user_id}`}>
                      <TrendingUpIcon /> Progress
                    </Link>
                  </Button>
                )}
                {!tutoring && !quest && assessment && (
                  <Button asChild size="sm" variant="outline" data-testid={`home-child-assessments-${child.student_user_id}`}>
                    <Link to="/assessments">
                      <PenLineIcon /> Assessments
                    </Link>
                  </Button>
                )}
              </div>
              {!tutoring && !quest && !assessment && (
                <p className="text-muted-foreground text-xs" data-testid={`home-child-off-${child.student_user_id}`}>
                  Lessons and quests are off in this space.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </SectionShell>
  );
}

function LearnerSection({ home, hideWaiting, nextShown }: { home: MemberHome; hideWaiting: boolean; nextShown: boolean }) {
  const { organization } = useAuth();
  const quest = featureOn(organization, 'quest');
  const assessment = featureOn(organization, 'assessment');
  const tutoring = featureOn(organization, 'tutoring');
  // Next up already names the lesson when it is the learner's next lesson: not twice.
  const next = nextShown ? null : home.learner!.next_lesson;
  return (
    <SectionShell hat="learner">
      {!next && !quest && !assessment && (
        <p className="text-muted-foreground text-sm" data-testid="home-learner-empty">
          Nothing to practise here yet: Quest and Assessments are off in this space.
        </p>
      )}
      {next && (
        <Card className="py-0" data-testid="home-learner-next">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <CalendarDaysIcon className="text-primary size-5" aria-hidden />
            <span className="min-w-0 flex-1">
              Your next lesson: <span className="font-medium">{lessonWhen(next.occurs_on, next.start_time, home.day)}</span> with{' '}
              {firstName(next.tutor_name)}
            </span>
          </CardContent>
        </Card>
      )}
      {/* Phase 68 (H4): an assessment-led home puts Assessments first, in any space. */}
      {assessment && home.focus === 'assessment' && <AssessmentSection />}
      {quest && <PlayHome hideWaiting={hideWaiting} />}
      {assessment && !tutoring && home.focus !== 'assessment' && <AssessmentSection />}
    </SectionShell>
  );
}

/** Phase 68 (H4): "Make this my home" -- the person pins what leads, or leaves it automatic. */
function PinHome({ home }: { home: MemberHome }) {
  const pin = usePinHome();
  const choices: (HomeFocus | null)[] = [null, ...(home.focus_options ?? [])];
  return (
    <section className="grid gap-2" data-testid="home-pin" aria-labelledby="home-pin-heading">
      <h2 id="home-pin-heading" className="text-muted-foreground flex items-center gap-2 text-sm font-semibold">
        <HomeIcon className="size-4" aria-hidden /> Make this my home
      </h2>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="home-pin-heading">
        {choices.map((focus) => {
          const chosen = (home.pin ?? null) === focus;
          return (
            <button
              key={focus ?? 'auto'}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={pin.isPending}
              onClick={() => !chosen && pin.mutate(focus)}
              data-testid={`home-pin-${focus ?? 'auto'}`}
              className={cn(
                'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
                chosen ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-muted',
              )}
            >
              {focus ? HOME_FOCUS_LABELS[focus] : `Automatic${home.pin ? '' : ` (${HOME_FOCUS_LABELS[home.focus ?? 'quest']})`}`}
            </button>
          );
        })}
      </div>
    </section>
  );
}
