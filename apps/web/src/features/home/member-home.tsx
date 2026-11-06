import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3Icon,
  HomeIcon,
  UsersIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ClipboardCheckIcon,
  CompassIcon,
  KeyRoundIcon,
  Loader2Icon,
  MapPinIcon,
  PencilLineIcon,
  PenLineIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  TargetIcon,
  TrendingUpIcon,
  UserIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  HOME_FOCUS_LABELS,
  HOME_HAT_LABELS,
  QUEST_GRADE_NOT_IN_SCHOOL,
  STREAK_DAYS_PER_WEEK,
  boardGrades,
  dailyLevelFor,
  featureOn,
  tourOffered,
  homeGreeting,
  lessonWhen,
  lessonDayWords,
  mayMakeSpace,
  orderHats,
  playTogetherRequest,
  practiseBefore,
  practiseRequest,
  quickActionLabel,
  quickActionsFor,
  startsInWords,
  type HabitSummary,
  type HomeChild,
  type HomeFocus,
  type HomeHat,
  type HomeOffice,
  type CreateGameRequest,
  type HomeTutor,
  type MemberHome,
  type MemberTile,
  type NextUp,
  type QuickAction,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AssessmentSection } from '@/features/dashboard/assessment-home';
import { useHabit } from '@/features/habit/habit-api';
import { LessonReminderSheet } from '@/features/locations/lesson-reminder';
import { TourOfferCard, useOnboarding } from '@/features/onboarding/onboarding-provider';
import { PlayFavorites, PlayHome, WaitingForYou, useStartQuest } from '@/features/play/play-home';
import { useMemberTiles } from '@/features/play/play-api';
import { useGoToGame } from '@/features/quest/play-origin';
import { DraftMark, LessonRecorder, RECORD_CLOSED, type KnownLesson, type RecordFlow } from '@/features/teaching/record-lesson';
import { StartLessonDialog } from '@/features/teaching/start-session-button';
import { AddPersonDialog } from '@/features/users/add-person';
import { CodeSheet, KeptForYou } from '@/features/organizations/code-sheet';
import { RequestOutcomes } from '@/features/organizations/request-outcomes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { useBrand } from '@/providers/brand-provider';
import { useMemberHome, usePinHome } from './api';
import { lessonLine } from './lesson-words';
import { NextUpCard, useNextUp } from './next-up';

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
  const { item, putOff, practiceLevel, active } = useNextUp(home);
  // The learner's habit (shared with the band and My progress through the query cache).
  const habit = useHabit(Boolean(home && orderHats(home)[0] === 'learner') && featureOn(organization, 'quest'));
  // Phase 75 (JF30): one way to record -- the lessons owed, a known lesson, or its draft -- and Start in place.
  const [recordFlow, setRecordFlow] = useState<RecordFlow>(RECORD_CLOSED);
  const [starting, setStarting] = useState(false);
  // Phase 76 (JF21): the one Add chooser.
  const [adding, setAdding] = useState(false);
  // The one "Have a code?" sheet (JF4): null is closed. A shared game link (`/?code=`, the lobby's QR) opens it.
  const [params, setParams] = useSearchParams();
  const [codeSheet, setCodeSheet] = useState<string | null>(() => params.get('code'));
  const closeCodeSheet = () => {
    setCodeSheet(null);
    if (params.has('code')) {
      params.delete('code');
      setParams(params, { replace: true });
    }
  };

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
  // Phase 74 (JF6): a learner who has never played here gets the doors in the band (Play, Join with a code, Start a
  // space) -- so the quick "Have a code?" beside them is not a second door to the same sheet.
  const newcomer = hats[0] === 'learner' && quest && habit.data?.data.played_before === false;
  // Phase 74 (JF23): the board carries its own New Quest, so the quick action is not shown beside it.
  const boardShown = quest && hats.includes('learner');
  const actions = quickActionsFor(hats, {
    tutoring,
    quest,
    assessment,
    mayBringPeople: home.may_bring_people,
    mayAssess: home.may_assess,
    board: boardShown,
    doors: newcomer,
    personal: home.personal,
  });
  const openLesson = (lesson: KnownLesson) => setRecordFlow({ kind: 'lesson', lesson });

  return (
    <div className="mx-auto grid max-w-6xl gap-6" data-testid="member-home">
      {tutoring && <LessonReminderSheet />}
      {/* The person's requests to join spaces and the answers, until dismissed (owner, 2026-11-04; JF5). */}
      <RequestOutcomes />
      <KeptForYou onCode={(code) => setCodeSheet(code)} />
      {codeSheet !== null && <CodeSheet initialCode={codeSheet} onClose={closeCodeSheet} />}
      {/* Phase 74 (JF25): the tour, offered once, in the page's flow -- never over the work it introduces. */}
      <TourOfferCard />
      <div className="relative">
        <Band home={home} hat={hats[0] ?? null} nextUp={item} newcomer={newcomer} onCode={() => setCodeSheet('')} />
        <div className="relative -mt-12 px-3 sm:px-6">
          <NextUpCard
            home={home}
            item={item}
            active={active}
            onLater={(next: NextUp) => putOff(next)}
            onRecord={openLesson}
            practiceLevel={practiceLevel}
          />
        </div>
      </div>

      {actions.length > 0 && (
        <QuickActions
          actions={actions}
          onRecord={() => setRecordFlow({ kind: 'owed' })}
          onStart={() => setStarting(true)}
          onAdd={() => setAdding(true)}
          onCode={() => setCodeSheet('')}
        />
      )}

      {hats.map((hat) => (
        <HatSection
          key={hat}
          hat={hat}
          home={home}
          nextUp={item}
          practiceLevel={practiceLevel}
          onRecord={openLesson}
          onOwed={() => setRecordFlow({ kind: 'owed' })}
        />
      ))}

      {/* Where Quest is on, a member who does not wear the learner hat keeps their favorites in one tap. */}
      {quest && !hats.includes('learner') && (
        <section className="grid gap-3 empty:hidden" data-testid="home-play-row">
          <PlayFavorites compact />
          {item?.kind !== 'game_invite' && <WaitingForYou />}
        </section>
      )}

      {(home.focus_options?.length ?? 0) > 1 && <PinHome home={home} />}

      {/* A tutor's doors only: nobody else's home reads lessons owed, drafts or pairings. */}
      {tutoring && hats.includes('tutor') && (
        <>
          <LessonRecorder flow={recordFlow} onFlow={setRecordFlow} showMoney={false} />
          {starting && <StartLessonDialog open onOpenChange={setStarting} />}
        </>
      )}
      {home.may_bring_people && <AddPersonDialog open={adding} onOpenChange={setAdding} />}
    </div>
  );
}

/**
 * The guest home's band, slimmer: the greeting, the space, and one line for the hat that leads. Phase 74 (JF6, JF16):
 * never a zero -- a learner who has not played here gets three doors and "Start a streak" -- and never what Next up,
 * just below, already says.
 */
function Band({
  home,
  hat,
  nextUp,
  newcomer,
  onCode,
}: {
  home: MemberHome;
  hat: HomeHat | null;
  nextUp: NextUp | null;
  /** A learner who has never played here (JF6): the doors in, not a count. */
  newcomer: boolean;
  onCode: () => void;
}) {
  const brand = useBrand();
  const { organization, account, memberships, platformAdmin } = useAuth();
  const quest = featureOn(organization, 'quest');
  const habit = useHabit(hat === 'learner' && quest);
  const { openWizard } = useOnboarding();
  const summary = habit.data?.data ?? null;
  const mayStart = mayMakeSpace({ account, memberships, platform_admin: platformAdmin });
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
          {newcomer ? 'Start a streak: play on three days this week.' : stripLine(home, hat, summary, nextUp, featureOn(organization, 'tutoring'), quest)}
        </p>
        {newcomer && (
          <div className="mt-2 flex flex-wrap gap-2" data-testid="home-doors">
            <BandDoor
              icon={PlayIcon}
              label="Play"
              testId="home-door-play"
              onClick={() => document.querySelector('[data-testid="play-home"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />
            <BandDoor icon={KeyRoundIcon} label="Join with a code" testId="home-door-code" onClick={onCode} />
            {mayStart && <BandDoor icon={SparklesIcon} label="Start a space" testId="home-door-start" href="/spaces#start" />}
          </div>
        )}
      </div>
    </div>
  );
}

/** A door in the band: a light outline pill on the brand's dark ground. */
function BandDoor({
  icon: Icon,
  label,
  testId,
  onClick,
  href,
}: {
  icon: LucideIcon;
  label: string;
  testId: string;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    'inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/60 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none';
  return href ? (
    // A full load, so the Spaces page opens on its Start a space card.
    <a href={href} className={className} data-testid={testId}>
      <Icon className="size-4" aria-hidden /> {label}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className} data-testid={testId}>
      <Icon className="size-4" aria-hidden /> {label}
    </button>
  );
}

const names = (kids: readonly HomeChild[]) =>
  kids.length <= 1 ? (kids[0]?.first_name ?? '') : `${kids.slice(0, -1).map((k) => k.first_name).join(', ')} and ${kids[kids.length - 1]!.first_name}`;

/**
 * The band's one line for the hat that leads (Phase 66), never a zero and never what Next up says (Phase 74: JF6,
 * JF16, JF23). Where Tutoring is off, the office's and a parent's lines say nothing about lessons.
 */
function stripLine(
  home: MemberHome,
  hat: HomeHat | null,
  habit: HabitSummary | null,
  nextUp: NextUp | null,
  tutoring: boolean,
  quest: boolean,
): string {
  switch (hat) {
    case 'tutor': {
      const t = home.tutor!;
      return [`Today: ${plural(t.lessons_today, 'lesson')}`, t.to_record_count ? `${t.to_record_count} to record` : null]
        .filter(Boolean)
        .join(' · ');
    }
    case 'office': {
      const o = home.office!;
      // Next up names these counts already: the band does not say them again.
      const saysRecord = nextUp?.kind === 'office_to_record';
      const saysPeople = nextUp?.kind === 'office_needs';
      const parts = [
        tutoring && o.to_record_count && !saysRecord ? `${o.to_record_count} to record` : null,
        o.invitations && !saysPeople ? `${o.invitations} invited` : null,
        o.join_requests && !saysPeople ? `${o.join_requests} asking to join` : null,
        o.assessments_open ? `${plural(o.assessments_open, 'assessment')} to look at` : null,
      ].filter(Boolean);
      if (parts.length) return parts.join(' · ');
      if (saysRecord || saysPeople) return tutoring ? `This week: ${plural(o.lessons_this_week, 'lesson')}` : 'Here is what needs you.';
      return tutoring ? `All caught up · ${plural(o.lessons_this_week, 'lesson')} this week` : 'All caught up';
    }
    case 'parent': {
      const kids = home.parent!.children;
      const child = kids[0];
      if (!child) return 'Your children';
      if (!tutoring) {
        // Counts only (R29): the child's week of play, where Quest is on.
        if (quest && child.days_played_this_week != null) {
          return child.days_played_this_week > 0
            ? `${child.first_name}: ${plural(child.days_played_this_week, 'day')} played this week`
            : `${child.first_name}: no play yet this week`;
        }
        return `${kids.length === 1 ? 'Your child' : 'Your children'}: ${names(kids)}`;
      }
      // Next up names this child's lesson already: the band names the children, not the lesson again.
      const shown = (nextUp?.kind === 'child_next_lesson' || nextUp?.kind === 'child_change') && nextUp.child.student_user_id === child.student_user_id;
      if (shown) return `${kids.length === 1 ? 'Your child' : 'Your children'}: ${names(kids)}`;
      if (child.next_lesson) return `${child.first_name}: next lesson ${lessonLine(child.next_lesson, home.day)}`;
      return `${child.first_name}: no lessons scheduled`;
    }
    case 'learner': {
      const next = home.learner!.next_lesson;
      const nextShown = nextUp?.kind === 'learner_lesson' || nextUp?.kind === 'practise_before';
      if (next && !nextShown) return `Next lesson ${lessonLine(next, home.day)}`;
      if (habit) {
        // Never a zero first (JF16): "Start a streak" in words until a day is played.
        if (habit.streak_weeks > 0) {
          return habit.days_this_week > 0
            ? `${habit.streak_weeks}-week streak · ${Math.min(habit.days_this_week, STREAK_DAYS_PER_WEEK)} of ${STREAK_DAYS_PER_WEEK} days this week`
            : `${habit.streak_weeks}-week streak · play this week to keep it`;
        }
        if (habit.days_this_week === 0) return 'Start a streak: play on three days this week.';
        return `${habit.days_this_week} of ${STREAK_DAYS_PER_WEEK} days played this week`;
      }
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

/** Each quick action's icon and where it goes; its words are shared with the app (`QUICK_ACTION_LABELS`, Phase 78). */
const QUICK: Record<QuickAction, { icon: LucideIcon; to?: string }> = {
  record_lesson: { icon: PencilLineIcon },
  start_lesson: { icon: PlayIcon },
  new_quest: { icon: PlusIcon, to: '/quest/games/new' },
  join_code: { icon: KeyRoundIcon },
  start_assessment: { icon: ClipboardCheckIcon, to: '/assessments' },
  add_person: { icon: UserPlusIcon },
  schedule: { icon: CalendarDaysIcon, to: '/schedule' },
  progress: { icon: TrendingUpIcon, to: '/progress' },
};

function QuickActions({
  actions,
  onRecord,
  onStart,
  onAdd,
  onCode,
}: {
  actions: QuickAction[];
  onRecord: () => void;
  onStart: () => void;
  onAdd: () => void;
  onCode: () => void;
}) {
  const navigate = useNavigate();
  const { organization } = useAuth();
  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap" data-testid="home-quick-actions">
      {actions.map((action) => {
        const { icon: Icon, to } = QUICK[action];
        // In a personal space the person added is one's child (Phase 76, JF21).
        const label = quickActionLabel(action, { personal: organization?.personal });
        const onClick = () => {
          if (action === 'record_lesson') onRecord();
          else if (action === 'start_lesson') onStart();
          else if (action === 'add_person') onAdd();
          else if (action === 'join_code') onCode();
          // A full-screen Quest page goes back home (JF36).
          else if (to) navigate(to, to.startsWith('/quest/') ? { state: { from: '/' } } : undefined);
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
  practiceLevel,
  onRecord,
  onOwed,
}: {
  hat: HomeHat;
  home: MemberHome;
  nextUp: NextUp | null;
  practiceLevel: string | null;
  onRecord: (lesson: KnownLesson) => void;
  onOwed: () => void;
}) {
  switch (hat) {
    case 'tutor':
      return <TutorSection home={home} tutor={home.tutor!} nextUp={nextUp} onRecord={onRecord} onOwed={onOwed} />;
    case 'office':
      return <OfficeSection home={home} office={home.office!} />;
    case 'parent':
      // A child's card is their lessons; where there is no Tutoring their assessments are under
      // Practice (Phase 68 adds what they played).
      return <ParentSection home={home} kids={home.parent!.children} />;
    case 'learner':
      return (
        <LearnerSection
          home={home}
          nextUp={nextUp}
          practiceLevel={practiceLevel}
          hideWaiting={nextUp?.kind === 'game_invite'}
          // Next up already names the lesson (as the lesson, or as practice for it): not twice.
          nextShown={nextUp?.kind === 'learner_lesson' || nextUp?.kind === 'practise_before'}
        />
      );
  }
}

function TutorSection({
  home,
  tutor,
  nextUp,
  onRecord,
  onOwed,
}: {
  home: MemberHome;
  tutor: HomeTutor;
  nextUp: NextUp | null;
  onRecord: (lesson: KnownLesson) => void;
  onOwed: () => void;
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
              {tutor.to_record.map((lesson) => {
                const key = `${lesson.schedule_id}-${lesson.occurs_on}`;
                const known: KnownLesson = {
                  tutor_user_id: user!.id,
                  student_user_id: lesson.student_user_id,
                  student_name: lesson.student_name,
                  occurs_on: lesson.occurs_on,
                  start_time: lesson.start_time,
                  end_time: lesson.end_time,
                  mode: lesson.mode,
                  place: lesson.place ? { name: lesson.place.name, kind: lesson.place.kind } : null,
                  draft: lesson.draft ?? null,
                };
                return (
                  <li key={key} className="flex flex-wrap items-center gap-2" data-testid={`home-to-record-${key}`}>
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{lesson.student_name}</span>{' '}
                      <span className="text-muted-foreground">· {capital(lessonWhen(lesson.occurs_on, lesson.start_time, home.day))}</span>
                    </span>
                    {/* Phase 75 (JF19): a draft of it is continued from here. */}
                    {lesson.draft ? (
                      <DraftMark draft={lesson.draft} onContinue={() => onRecord(known)} testId={`home-draft-${key}`} />
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => onRecord(known)} data-testid={`home-record-${key}`}>
                        <PencilLineIcon /> Record
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {tutor.to_record_count > tutor.to_record.length && (
            <button type="button" onClick={onOwed} className="text-primary justify-self-start text-sm font-medium" data-testid="home-to-record-more">
              +{tutor.to_record_count - tutor.to_record.length} more to record
            </button>
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
  const assessment = featureOn(organization, 'assessment');
  // Phase 74 (JF6): only what waits -- never "0 invitations not yet accepted" -- and one line when nothing does.
  const rows: { id: string; label: string; to: string; count: number }[] = [
    ...(tutoring ? [{ id: 'to-record', label: 'lessons not recorded (last 7 days)', to: '/sessions', count: office.to_record_count }] : []),
    { id: 'requests', label: 'asking to join', to: '/users', count: office.join_requests },
    { id: 'invitations', label: office.invitations === 1 ? 'invitation not yet accepted' : 'invitations not yet accepted', to: '/users', count: office.invitations },
    ...(assessment
      ? [
          {
            id: 'assessments',
            label: (office.assessments_open ?? 0) === 1 ? 'assessment submitted, to look at' : 'assessments submitted, to look at',
            to: '/assessments',
            count: office.assessments_open ?? 0,
          },
        ]
      : []),
  ].filter((row) => row.count > 0);
  return (
    <SectionShell hat="office" aside={tutoring ? `Today: ${plural(office.lessons_today, 'lesson')} · this week: ${office.lessons_this_week}` : undefined}>
      <Card className="py-0">
        <CardContent className="grid gap-2 p-4 text-sm">
          {rows.length === 0 ? (
            <p className="text-muted-foreground flex items-center gap-2" data-testid="home-office-nothing">
              <CheckCircle2Icon className="text-success size-4" aria-hidden /> Nothing needs you right now.
            </p>
          ) : (
            rows.map((row) => (
              <Link
                key={row.id}
                to={row.to}
                className="hover:bg-muted flex items-center gap-3 rounded-lg px-2 py-1.5"
                data-testid={`home-office-${row.id}`}
              >
                <span className="font-display text-primary w-8 text-right text-lg font-bold">{row.count}</span>
                <span>{row.label}</span>
              </Link>
            ))
          )}
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
  // Phase 68 (H10): "Play with <child>" starts at the child's level -- since Phase 77 (JF15) their grade, through the
  // Daily's rule; else the level they played last; else this space's first tile.
  const tiles = useMemberTiles(quest && kids.length > 0);
  const tileList = tiles.data?.data.tiles ?? [];
  const { start, pending } = useStartQuest();
  const goToGame = useGoToGame();
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
                      {/* Phase 74 (JF17): where, by the place's name. */}
                      {child.next_lesson.place && (
                        <span className="text-muted-foreground" data-testid={`home-child-place-${child.student_user_id}`}>
                          {' '}
                          ·{' '}
                          <span className="inline-flex items-baseline gap-1">
                            <MapPinIcon className="size-3.5 shrink-0 self-center" aria-hidden />
                            {child.next_lesson.place.name}
                          </span>
                        </span>
                      )}
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
                {quest && (
                  <PlayTogether
                    child={child}
                    level={childPlayLevel(child, tileList)}
                    today={home.day}
                    pending={pending}
                    onStart={start}
                    onContinue={goToGame}
                  />
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
                {/* Phase 74 (JF31): a parent's menu has no Users; where there is no Progress page, the card leads to the child. */}
                {!tutoring && (
                  <Button asChild size="sm" variant="outline" data-testid={`home-child-open-${child.student_user_id}`}>
                    <Link to={`/users?view=${child.student_user_id}`}>
                      <UserIcon /> {child.first_name}&apos;s details
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

/**
 * Phase 77 (JF15): the level "Play with <child>" plays at -- the child's grade through the Daily's rule (0, "Not in
 * school", is the top of the row, as on one's own board); else the level they played last; else this space's first tile.
 */
function childPlayLevel(child: HomeChild, tiles: readonly MemberTile[]): string | null {
  const grades = boardGrades(tiles) as readonly number[];
  const grade = child.grade === QUEST_GRADE_NOT_IN_SCHOOL ? (grades.at(-1) ?? null) : (child.grade ?? null);
  if (grade !== null && grades.includes(grade)) return dailyLevelFor(tiles, grade);
  return child.play_level_id ?? tiles[0]?.level_id ?? null;
}

/**
 * Phase 68 (H10), Phase 77 (JF15): "Play with <child>". A child who signs in is invited online, as before; one who does
 * not plays beside the parent on this device -- one tap, the game begun at once, no code to share. A game the reader
 * seated them in that still runs is "Continue with <child>", back on whoever's turn it is.
 */
function PlayTogether({
  child,
  level,
  today,
  pending,
  onStart,
  onContinue,
}: {
  child: HomeChild;
  level: string | null;
  today: string;
  pending: boolean;
  onStart: (request: CreateGameRequest) => Promise<void>;
  onContinue: (gameId: string) => void;
}) {
  const id = child.student_user_id;
  if (child.open_game_id) {
    const gameId = child.open_game_id;
    return (
      <Button size="sm" onClick={() => onContinue(gameId)} data-testid={`home-child-continue-${id}`}>
        <PlayIcon /> Continue with {child.first_name}
      </Button>
    );
  }
  if (!level) return null;
  const onDevice = child.signs_in === false;
  const practise = practiseBefore(child.next_lesson, today);
  const label = practise
    ? `Practise together before ${lessonDayWords(child.next_lesson!.occurs_on, today)}`
    : onDevice
      ? `Play with ${child.first_name} on this device`
      : `Play with ${child.first_name}`;
  return (
    <>
      <Button size="sm" disabled={pending} onClick={() => void onStart(playTogetherRequest(child, level))} data-testid={`home-child-play-${id}`}>
        <UsersIcon />
        {label}
      </Button>
      {onDevice && practise && (
        <span className="text-muted-foreground basis-full text-xs" data-testid={`home-child-on-device-${id}`}>
          {child.first_name} plays beside you, on this device.
        </span>
      )}
    </>
  );
}

function LearnerSection({
  home,
  nextUp,
  practiceLevel,
  hideWaiting,
  nextShown,
}: {
  home: MemberHome;
  nextUp: NextUp | null;
  practiceLevel: string | null;
  hideWaiting: boolean;
  nextShown: boolean;
}) {
  const { organization } = useAuth();
  const quest = featureOn(organization, 'quest');
  const assessment = featureOn(organization, 'assessment');
  const tutoring = featureOn(organization, 'tutoring');
  const { start, pending } = useStartQuest();
  // Next up already names the lesson when it is the learner's next lesson: not twice.
  const next = nextShown ? null : home.learner!.next_lesson;
  // Phase 74 (JF17): where Quest is on, the lesson line opens practice for it.
  const practise = quest && practiceLevel ? () => void start(practiseRequest(practiceLevel)) : null;
  return (
    <SectionShell hat="learner">
      {!next && !quest && !assessment && (
        <p className="text-muted-foreground text-sm" data-testid="home-learner-empty">
          Nothing to practise here yet: Quest and Assessments are off in this space.
        </p>
      )}
      {next && (
        <Card className="py-0" data-testid="home-learner-next">
          <CardContent className="p-0 text-sm">
            {practise ? (
              <button
                type="button"
                disabled={pending}
                onClick={practise}
                className="hover:bg-muted flex w-full flex-wrap items-center gap-3 rounded-xl p-4 text-left transition-colors"
                data-testid="home-learner-practise"
              >
                <CalendarDaysIcon className="text-primary size-5" aria-hidden />
                <span className="min-w-0 flex-1">
                  Your next lesson: <span className="font-medium">{lessonLine(next, home.day)}</span>
                </span>
                <span className="text-primary inline-flex items-center gap-1 font-semibold">
                  <TargetIcon className="size-4" aria-hidden /> {pending ? 'Starting…' : 'Practise for it'}
                </span>
              </button>
            ) : (
              <p className="flex flex-wrap items-center gap-3 p-4">
                <CalendarDaysIcon className="text-primary size-5" aria-hidden />
                <span className="min-w-0 flex-1">
                  Your next lesson: <span className="font-medium">{lessonLine(next, home.day)}</span>
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {/* Phase 68 (H4): an assessment-led home puts Assessments first, in any space. */}
      {assessment && home.focus === 'assessment' && <AssessmentSection />}
      {quest && <PlayHome hideWaiting={hideWaiting} nextUp={nextUp} />}
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
