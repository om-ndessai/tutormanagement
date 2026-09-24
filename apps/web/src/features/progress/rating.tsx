import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleSlashIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TargetIcon,
  TrophyIcon,
} from 'lucide-react';
import {
  PROGRESS_STATUS_LABELS,
  RATINGS,
  TOPIC_RATING_LABELS,
  type ProgressStatus,
  type Rating,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Fill and text for one step of the 1-5 scale, from the tokens in index.css. */
export function ratingStyle(rating: Rating) {
  return {
    backgroundColor: `var(--rating-${rating})`,
    color: `var(--rating-${rating}-ink)`,
  } as const;
}

/**
 * A score as a small filled square with its number. The number is always
 * printed, so the colour is never the only way to read it.
 */
export function RatingChip({
  rating,
  labels = TOPIC_RATING_LABELS,
  className,
}: {
  rating: Rating | null;
  labels?: Record<Rating, string>;
  className?: string;
}) {
  if (rating === null) {
    return (
      <span
        className={cn(
          'text-muted-foreground inline-flex size-6 items-center justify-center rounded-md border border-dashed text-xs',
          className,
        )}
        title="Not rated"
      >
        –
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md text-xs font-semibold tabular-nums',
        className,
      )}
      style={ratingStyle(rating)}
      title={`${rating} · ${labels[rating]}`}
    >
      {rating}
    </span>
  );
}

/**
 * Five buttons in a row, with a clear option. A radio group underneath, so a
 * keyboard reaches it and a screen reader announces the label, not the digit.
 */
export function RatingPicker({
  value,
  onChange,
  labels = TOPIC_RATING_LABELS,
  name,
  allowClear = true,
  neutral = false,
}: {
  value: Rating | null;
  onChange: (value: Rating | null) => void;
  labels?: Record<Rating, string>;
  /** Accessible name of the group, e.g. the topic being rated. */
  name: string;
  allowClear?: boolean;
  /**
   * For a CENTRED scale -- 3 is right, 1 and 5 are the two ways to miss
   * (Phase 25's difficulty and pace). The chosen step takes the primary
   * colour instead of the rating ramp, which would read darker as better.
   */
  neutral?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex items-center gap-1">
      {RATINGS.map((rating) => {
        const selected = value === rating;

        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${rating} – ${labels[rating]}`}
            title={labels[rating]}
            onClick={() => onChange(selected && allowClear ? null : rating)}
            className={cn(
              'focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-all outline-none focus-visible:ring-[3px]',
              selected ? 'border-transparent shadow-sm' : 'text-muted-foreground hover:bg-accent',
              selected && neutral && 'bg-primary text-primary-foreground',
            )}
            style={selected && !neutral ? ratingStyle(rating) : undefined}
          >
            {rating}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A value on a CENTRED 1-5 scale, as a chip: neutral in the middle, and the
 * warning tone at either end -- "far too easy" is as much a miss as "far too
 * hard". The number is always printed and the label is its title.
 */
export function ScaleChip({
  value,
  labels,
  className,
}: {
  value: Rating | null;
  labels: Record<Rating, string>;
  className?: string;
}) {
  if (value === null) return <RatingChip rating={null} className={className} />;

  const extreme = value === 1 || value === 5;
  return (
    <span
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md border text-xs font-semibold tabular-nums',
        extreme
          ? 'border-warning/60 text-warning-foreground dark:text-warning bg-warning/15'
          : 'bg-muted text-foreground border-transparent',
        className,
      )}
      title={`${value} · ${labels[value]}`}
    >
      {value}
    </span>
  );
}

/** The legend for the 1-5 scale, so a chip is never read on colour alone. */
export function RatingLegend({ labels = TOPIC_RATING_LABELS }: { labels?: Record<Rating, string> }) {
  return (
    <ul className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {RATINGS.map((rating) => (
        <li key={rating} className="flex items-center gap-1.5">
          <RatingChip rating={rating} labels={labels} className="size-5 text-[10px]" />
          {labels[rating]}
        </li>
      ))}
    </ul>
  );
}

const STATUS_ICONS: Record<ProgressStatus, typeof TargetIcon> = {
  no_plan: CircleDashedIcon,
  not_started: CircleDashedIcon,
  ahead: TrendingUpIcon,
  on_track: CircleCheckIcon,
  behind: TrendingDownIcon,
  achieved: TrophyIcon,
  closed: CircleSlashIcon,
};

/**
 * Where a student stands, as icon + word. Status colours are reserved for
 * exactly this, and never carry the meaning on their own.
 */
export function ProgressStatusBadge({ status }: { status: ProgressStatus }) {
  const Icon = STATUS_ICONS[status];
  const tone = {
    ahead: 'border-success/40 text-success',
    on_track: 'border-success/40 text-success',
    achieved: 'border-success/40 text-success',
    behind: 'border-warning/60 text-warning-foreground dark:text-warning',
    no_plan: 'text-muted-foreground',
    not_started: 'text-muted-foreground',
    closed: 'text-muted-foreground',
  }[status];

  return (
    <Badge variant="outline" className={cn('gap-1', tone)}>
      <Icon />
      {PROGRESS_STATUS_LABELS[status]}
    </Badge>
  );
}

/** "BA3.10 Fractions" with the code set apart, which is how the office reads them. */
export function TopicName({
  id,
  name,
  unit,
  className,
}: {
  id: string;
  name: string | undefined;
  unit?: string | null;
  className?: string;
}) {
  return (
    <span className={cn('min-w-0', className)}>
      <span className="text-muted-foreground mr-1.5 font-mono text-[11px]">{id}</span>
      <span>{name ?? 'Unknown topic'}</span>
      {unit && <span className="text-muted-foreground ml-1 text-xs">({unit})</span>}
    </span>
  );
}
