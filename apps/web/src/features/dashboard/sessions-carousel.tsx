import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon, MapPinIcon } from 'lucide-react';
import {
  SESSION_MODE_LABELS,
  formatClockTime,
  formatDuration,
  formatMinutesOfDay,
  parseClockTime,
  zonedClockParts,
  type TutoringSession,
  type UpcomingSession,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUpcomingSessions } from '@/features/schedules/api';
import { cn } from '@/lib/utils';
import { EmptyNote } from './stat-card';

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** "Today", "Tomorrow", "Yesterday", else "Thu, Sep 25". */
function relativeDay(iso: string, today: string): string {
  const gap = dayNumber(iso) - dayNumber(today);
  if (gap === 0) return 'Today';
  if (gap === 1) return 'Tomorrow';
  if (gap === -1) return 'Yesterday';

  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "in 45 min", "in 2 hr 10 min", "Under way", or "Tomorrow at 4:00 PM". */
function countdown(next: UpcomingSession, today: string, nowMinutes: number): string {
  const start = parseClockTime(next.start_time) ?? 0;

  if (next.occurs_on === today) {
    const left = start - nowMinutes;
    if (left <= 0) return 'Under way';
    return `in ${formatDuration(left)}`;
  }

  return `${relativeDay(next.occurs_on, today)} at ${formatMinutesOfDay(start)}`;
}

/**
 * The dashboard's lessons, as one strip (Phase 21): the last few taught on the
 * left, "now", then what the schedules say is coming. The strip opens with
 * the next lesson centred -- the past to its left, what follows to its right
 * -- or "now" centred when nothing is scheduled. Spacers at both ends let it
 * centre even when there is little on one side. The right arrow pulls in
 * five more.
 *
 * Only the strip scrolls sideways -- never the page, which the responsive
 * spec checks at phone widths. Nothing here carries money: it sits on the
 * Tutoring tab, which a tutor may have open beside a student.
 */
export function SessionsCarousel({
  past,
  tutorUserId,
  showTutor,
}: {
  /** Newest first, as the API returns them. */
  past: TutoringSession[];
  /** Narrows the upcoming lessons to one tutor's teaching. */
  tutorUserId?: string;
  showTutor: boolean;
}) {
  const upcoming = useUpcomingSessions(tutorUserId);
  const track = useRef<HTMLDivElement | null>(null);
  const placed = useRef(false);
  const [edges, setEdges] = useState({ left: false, right: false });

  const clock = zonedClockParts(new Date().toISOString());
  const pastOldestFirst = [...past].reverse();
  const next = upcoming.data?.pages.flatMap((page) => page.data) ?? [];
  // The highlighted lesson is the next one actually happening: a cancelled
  // date keeps its place in the strip, but is never "next up".
  const firstLive = next.findIndex((occurrence) => !occurrence.cancellation);

  const measure = useCallback(() => {
    const element = track.current;
    if (!element) return;
    setEdges({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    });
  }, []);

  // Centre the next lesson (or "now") once the first page is in, and never
  // yank the strip after.
  useLayoutEffect(() => {
    const element = track.current;
    if (placed.current || upcoming.isPending || !element) return;
    const anchor =
      element.querySelector<HTMLElement>('[data-anchor="next"]') ??
      element.querySelector<HTMLElement>('[data-anchor="now"]');
    if (!anchor) return;
    element.scrollLeft =
      anchor.offsetLeft - element.offsetLeft + anchor.offsetWidth / 2 - element.clientWidth / 2;
    placed.current = true;
    measure();
  }, [upcoming.isPending, measure]);

  useEffect(() => {
    measure();
  }, [next.length, measure]);

  async function forward() {
    const element = track.current;
    if (!element) return;

    const remaining = element.scrollWidth - element.clientWidth - element.scrollLeft;
    if (remaining < element.clientWidth && upcoming.hasNextPage && !upcoming.isFetchingNextPage) {
      await upcoming.fetchNextPage();
    }
    // After the new cards have laid out.
    requestAnimationFrame(() =>
      track.current?.scrollBy({ left: Math.round(element.clientWidth * 0.8), behavior: 'smooth' }),
    );
  }

  function back() {
    const element = track.current;
    element?.scrollBy({ left: -Math.round(element.clientWidth * 0.8), behavior: 'smooth' });
  }

  if (!upcoming.isPending && past.length === 0 && next.length === 0) {
    return (
      <EmptyNote>
        No lessons recorded or scheduled yet.{' '}
        <Link to="/schedule" className="text-primary hover:underline">
          Set up a schedule
        </Link>
      </EmptyNote>
    );
  }

  const canForward = edges.right || Boolean(upcoming.hasNextPage);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Earlier sessions"
          disabled={!edges.left}
          onClick={back}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          aria-label="Later sessions"
          disabled={!canForward || upcoming.isFetchingNextPage}
          onClick={() => void forward()}
        >
          <ChevronRightIcon />
        </Button>
      </div>

      <div
        ref={track}
        onScroll={measure}
        data-testid="sessions-track"
        className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        <Spacer />
        {pastOldestFirst.map((session) => (
          <PastCard key={session.id} session={session} today={clock.day} showTutor={showTutor} />
        ))}
        {past.length === 0 && (
          <div className="text-muted-foreground flex w-44 shrink-0 snap-center items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs">
            No sessions recorded yet
          </div>
        )}

        <div
          data-anchor="now"
          aria-hidden
          className="flex shrink-0 snap-center flex-col items-center gap-1 self-stretch px-0.5"
        >
          <span className="text-primary text-[10px] font-semibold tracking-wide uppercase">Now</span>
          <span className="bg-primary/50 w-px flex-1" />
        </div>

        {upcoming.isPending &&
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-56 shrink-0 rounded-xl" />
          ))}

        {next.map((occurrence, index) =>
          occurrence.cancellation ? (
            <CancelledCard
              key={`${occurrence.schedule_id}-${occurrence.occurs_on}`}
              occurrence={occurrence}
              today={clock.day}
              showTutor={showTutor}
            />
          ) : index === firstLive ? (
            <NextCard
              key={`${occurrence.schedule_id}-${occurrence.occurs_on}`}
              occurrence={occurrence}
              today={clock.day}
              nowMinutes={clock.minutesOfDay}
              showTutor={showTutor}
            />
          ) : (
            <UpcomingCard
              key={`${occurrence.schedule_id}-${occurrence.occurs_on}`}
              occurrence={occurrence}
              today={clock.day}
              showTutor={showTutor}
            />
          ),
        )}

        {!upcoming.isPending && next.length === 0 && (
          <Link
            to="/schedule"
            className="text-muted-foreground hover:text-primary flex w-44 shrink-0 snap-center items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs"
          >
            Nothing scheduled. Set up a schedule →
          </Link>
        )}

        {upcoming.isFetchingNextPage && <Skeleton className="h-36 w-56 shrink-0 rounded-xl" />}
        <Spacer />
      </div>
    </div>
  );
}

/**
 * Room at each end of the strip, so the card being centred can reach the
 * middle even with only one or two cards beside it. Half the strip, less half
 * the 18rem next card and the 0.75rem gap either side of the spacer.
 */
function Spacer() {
  return <div aria-hidden className="w-[max(0px,calc(50%-9.75rem))] shrink-0" />;
}

const CARD = 'flex shrink-0 snap-center flex-col rounded-xl border p-3.5 transition-colors';

function Who({
  student,
  tutor,
  showTutor,
  inverse,
}: {
  student: string;
  tutor: string;
  showTutor: boolean;
  inverse?: boolean;
}) {
  return (
    <p className="mt-1 truncate text-sm font-medium">
      {student}
      {showTutor && (
        <span className={cn('font-normal', inverse ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
          {' '}
          with {tutor}
        </span>
      )}
    </p>
  );
}

function PastCard({
  session,
  today,
  showTutor,
}: {
  session: TutoringSession;
  today: string;
  showTutor: boolean;
}) {
  return (
    <Link
      to={`/sessions?focus=${session.id}`}
      className={cn(CARD, 'bg-muted/40 hover:border-primary/40 w-56')}
      aria-label={`Past session: ${session.student_name}, ${relativeDay(session.occurred_on, today)}`}
    >
      <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
        {relativeDay(session.occurred_on, today)}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {formatClockTime(session.started_at)}–{formatClockTime(session.ended_at)} ·{' '}
        {formatDuration(session.duration_minutes)}
      </p>
      <Who student={session.student_name} tutor={session.tutor_name} showTutor={showTutor} />
      {session.notes && (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{session.notes}</p>
      )}
      <div className="mt-auto flex flex-wrap gap-1 pt-2">
        <Badge variant="secondary" className="text-[10px]">
          {SESSION_MODE_LABELS[session.mode]}
        </Badge>
        {session.auto_stopped && (
          <Badge
            variant="outline"
            className="border-warning/60 text-warning-foreground dark:text-warning text-[10px]"
          >
            Auto-stopped
          </Badge>
        )}
      </div>
    </Link>
  );
}

function UpcomingCard({
  occurrence,
  today,
  showTutor,
}: {
  occurrence: UpcomingSession;
  today: string;
  showTutor: boolean;
}) {
  const start = parseClockTime(occurrence.start_time) ?? 0;

  return (
    <Link
      to={`/schedule?focus=${occurrence.schedule_id}`}
      className={cn(CARD, 'bg-card hover:border-primary/40 w-56')}
      aria-label={`Upcoming session: ${occurrence.student_name}, ${relativeDay(occurrence.occurs_on, today)}`}
    >
      <p className="text-[11px] font-medium tracking-wide uppercase">
        {relativeDay(occurrence.occurs_on, today)}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {formatMinutesOfDay(start)}–{formatClockTime(occurrence.end_time)}
      </p>
      <Who student={occurrence.student_name} tutor={occurrence.tutor_name} showTutor={showTutor} />
      <Place occurrence={occurrence} />
    </Link>
  );
}

/**
 * A date the schedule would have had a lesson on, called off (Phase 24).
 * Muted and dashed, so the gap in the week is explained rather than silent;
 * it links to that date on the Schedule page, where it can be put back.
 */
function CancelledCard({
  occurrence,
  today,
  showTutor,
}: {
  occurrence: UpcomingSession;
  today: string;
  showTutor: boolean;
}) {
  const start = parseClockTime(occurrence.start_time) ?? 0;

  return (
    <Link
      to={`/schedule?focus=${occurrence.schedule_id}&on=${occurrence.occurs_on}`}
      className={cn(CARD, 'bg-muted/40 hover:border-primary/40 w-56 border-dashed')}
      aria-label={`Cancelled session: ${occurrence.student_name}, ${relativeDay(occurrence.occurs_on, today)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
          {relativeDay(occurrence.occurs_on, today)}
        </p>
        <Badge variant="outline" className="text-[10px]">
          Cancelled
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums line-through">
        {formatMinutesOfDay(start)}–{formatClockTime(occurrence.end_time)}
      </p>
      <Who student={occurrence.student_name} tutor={occurrence.tutor_name} showTutor={showTutor} />
      {occurrence.cancellation?.note && (
        <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{occurrence.cancellation.note}</p>
      )}
    </Link>
  );
}

/** The lesson that matters most: bigger, in the brand colour, with a countdown. */
function NextCard({
  occurrence,
  today,
  nowMinutes,
  showTutor,
}: {
  occurrence: UpcomingSession;
  today: string;
  nowMinutes: number;
  showTutor: boolean;
}) {
  const start = parseClockTime(occurrence.start_time) ?? 0;

  return (
    <Link
      to={`/schedule?focus=${occurrence.schedule_id}`}
      data-anchor="next"
      className={cn(
        CARD,
        'bg-primary text-primary-foreground border-primary w-72 shadow-md hover:shadow-lg',
      )}
      aria-label={`Next session: ${occurrence.student_name}, ${countdown(occurrence, today, nowMinutes)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="bg-primary-foreground/15 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Next up
        </span>
        <span className="text-primary-foreground/85 text-xs tabular-nums">
          {countdown(occurrence, today, nowMinutes)}
        </span>
      </div>
      <p className="font-display mt-2 text-lg leading-tight font-semibold">
        {relativeDay(occurrence.occurs_on, today)} · {formatMinutesOfDay(start)}
      </p>
      <p className="text-primary-foreground/80 text-xs tabular-nums">
        until {formatClockTime(occurrence.end_time)} · {formatDuration(occurrence.duration_minutes)}
      </p>
      <Who student={occurrence.student_name} tutor={occurrence.tutor_name} showTutor={showTutor} inverse />
      <Place occurrence={occurrence} inverse />
    </Link>
  );
}

function Place({ occurrence, inverse }: { occurrence: UpcomingSession; inverse?: boolean }) {
  return (
    <p
      className={cn(
        'mt-auto flex items-center gap-1 truncate pt-2 text-xs',
        inverse ? 'text-primary-foreground/80' : 'text-muted-foreground',
      )}
    >
      <MapPinIcon className="size-3 shrink-0" />
      <span className="truncate">
        {SESSION_MODE_LABELS[occurrence.mode]}
        {occurrence.location ? ` · ${occurrence.location}` : ''}
      </span>
    </p>
  );
}
