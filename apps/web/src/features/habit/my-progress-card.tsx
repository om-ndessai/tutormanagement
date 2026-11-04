import { AwardIcon, FlameIcon } from 'lucide-react';
import { STREAK_DAYS_PER_WEEK, type WeekDot } from '@tmi/shared';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useHabit } from './habit-api';

/**
 * Phase 64 (P17-P18): "My progress" -- the weekly streak (weeks in a row with 3 days played), today's
 * ring, and the badges. The reader's own; derived on every read, never stored.
 */
export function MyProgressCard() {
  const habit = useHabit();
  const data = habit.data?.data;
  if (!data) return null;
  const earned = data.badges.filter((badge) => badge.earned);
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
          <span className="font-semibold" data-testid="my-progress-streak">
            {data.streak_weeks === 0 ? 'Start a streak' : `${data.streak_weeks} week${data.streak_weeks === 1 ? '' : 's'} in a row`}
          </span>
          <span className="text-muted-foreground text-xs">
            {Math.min(data.days_this_week, STREAK_DAYS_PER_WEEK)} of {STREAK_DAYS_PER_WEEK} days this week
          </span>
        </span>
        {data.week && <WeekStrip week={data.week} />}
        {/* Phase 67 (H8): a kind word after a week away, never what was lost. */}
        {data.welcome_back && (
          <p className="text-primary w-full text-sm font-semibold" data-testid="my-progress-welcome">
            Welcome back! A fresh week starts now.
          </p>
        )}
        {data.next_badge && (
          <p className="text-muted-foreground w-full text-xs" data-testid="my-progress-next">
            Next badge: <span className="text-foreground font-semibold">{data.next_badge.label}</span> · {data.next_badge.have} of{' '}
            {data.next_badge.need}
          </p>
        )}
        <span className="ml-auto flex flex-wrap gap-1.5" aria-label="Badges">
          {earned.length === 0 ? (
            !data.next_badge && <span className="text-muted-foreground text-xs">Your first badge is one quest away.</span>
          ) : (
            earned.map((badge) => (
              <span key={badge.id} title={badge.description} className="bg-primary/10 text-primary flex items-center gap-1 rounded-full px-2 py-0.5 text-xs" data-testid={`badge-${badge.id}`}>
                <AwardIcon className="size-3" /> {badge.label}
              </span>
            ))
          )}
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
