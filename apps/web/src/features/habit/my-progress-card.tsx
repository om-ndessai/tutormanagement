import { AwardIcon, FlameIcon } from 'lucide-react';
import { STREAK_DAYS_PER_WEEK, type HabitSummary, type WeekDot } from '@tmi/shared';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useHabit } from './habit-api';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * Phase 73 (JF16): ONE state, from the current run -- a streak and what keeps it, a welcome back, or "Start a
 * streak" -- never two that disagree, and never a zero first. Badges earned stay listed below, as badges.
 */
function progressHeadline(data: Pick<HabitSummary, 'streak_weeks' | 'days_this_week' | 'welcome_back'>): { title: string; detail: string } {
  const left = Math.max(0, STREAK_DAYS_PER_WEEK - data.days_this_week);
  if (data.streak_weeks > 0) {
    return {
      title: `${data.streak_weeks}-week streak`,
      detail: left === 0 ? 'This week counts. Keep it going next week.' : `Play ${days(left)} more this week to keep it.`,
    };
  }
  if (data.welcome_back) return { title: 'Welcome back!', detail: `A fresh week starts now: play ${days(STREAK_DAYS_PER_WEEK)} to start a streak.` };
  return {
    title: 'Start a streak',
    detail:
      data.days_this_week === 0
        ? `Play on ${days(STREAK_DAYS_PER_WEEK)} this week.`
        : `${data.days_this_week} of ${STREAK_DAYS_PER_WEEK} days this week. ${left} to go.`,
  };
}

/**
 * Phase 64 (P17-P18): "My progress" -- the weekly streak (weeks in a row with 3 days played), today's
 * ring, and the badges. The reader's own; derived on every read, never stored.
 */
export function MyProgressCard() {
  const habit = useHabit();
  const data = habit.data?.data;
  if (!data) return null;
  const earned = data.badges.filter((badge) => badge.earned);
  const headline = progressHeadline(data);
  return (
    <Card className="py-0" data-testid="my-progress">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 text-sm">
        <span
          className={cn('flex size-10 items-center justify-center rounded-full border-2', data.played_today ? 'border-primary bg-primary/10' : 'border-muted')}
          aria-label={data.played_today ? 'Played today' : 'Not played yet today'}
          data-testid="my-progress-today"
        >
          <FlameIcon className={cn('size-5', data.played_today ? 'text-primary' : 'text-muted-foreground')} />
        </span>
        <span className="grid">
          {/* Phase 67 (H8): after a week away, a kind word in place of the streak -- never what was lost. */}
          <span
            className={cn('font-semibold', data.welcome_back && data.streak_weeks === 0 && 'text-primary')}
            data-testid={data.welcome_back && data.streak_weeks === 0 ? 'my-progress-welcome' : 'my-progress-streak'}
          >
            {headline.title}
          </span>
          <span className="text-muted-foreground text-xs" data-testid="my-progress-detail">
            {headline.detail}
          </span>
        </span>
        {data.week && <WeekStrip week={data.week} />}
        {data.next_badge && (
          <p className="text-muted-foreground w-full text-xs" data-testid="my-progress-next">
            Next badge: <span className="text-foreground font-semibold">{data.next_badge.label}</span> · {data.next_badge.have} of{' '}
            {data.next_badge.need}
          </p>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5" aria-label="Badges earned">
          {earned.length === 0 ? (
            !data.next_badge && <span className="text-muted-foreground text-xs">Your first badge is one quest away.</span>
          ) : (
            <span className="text-muted-foreground text-xs font-medium">Badges:</span>
          )}
          {earned.length > 0 &&
            earned.map((badge) => (
              <span key={badge.id} title={badge.description} className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" data-testid={`badge-${badge.id}`}>
                <AwardIcon className="size-3" /> {badge.label}
              </span>
            ))}
        </span>
      </CardContent>
    </Card>
  );
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DOT_WORDS: Record<WeekDot, string> = { played: 'played', missed: 'not played', today: 'today', ahead: 'to come' };

/** Phase 67 (H8): this week's seven days, Monday first; three played make the week count. */
function WeekStrip({ week }: { week: WeekDot[] }) {
  return (
    <span className="flex items-end gap-1.5" data-testid="my-progress-week" aria-label="This week">
      {week.map((dot, index) => (
        <span key={WEEKDAYS[index]} className="grid justify-items-center gap-0.5">
          <span
            role="img"
            aria-label={`${WEEKDAYS[index]}: ${DOT_WORDS[dot]}`}
            data-testid={`my-progress-day-${index}`}
            data-state={dot}
            className={cn(
              'size-3.5 rounded-full border-2',
              dot === 'played' && 'border-primary bg-primary',
              dot === 'today' && 'border-primary',
              dot === 'missed' && 'border-muted-foreground/30',
              dot === 'ahead' && 'border-border border-dashed',
            )}
          />
          <span className="text-muted-foreground text-[10px] leading-none" aria-hidden>
            {WEEKDAYS[index]![0]}
          </span>
        </span>
      ))}
    </span>
  );
}
