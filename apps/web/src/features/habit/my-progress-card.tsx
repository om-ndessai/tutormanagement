import { AwardIcon, FlameIcon } from 'lucide-react';
import { STREAK_DAYS_PER_WEEK } from '@tmi/shared';

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
        <span className="ml-auto flex flex-wrap gap-1.5" aria-label="Badges">
          {earned.length === 0 ? (
            <span className="text-muted-foreground text-xs">Your first badge is one quest away.</span>
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
