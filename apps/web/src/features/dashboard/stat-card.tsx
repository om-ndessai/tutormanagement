import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRightIcon } from 'lucide-react';
import { formatCents } from '@tmi/shared';

import { Card, CardContent } from '@/components/ui/card';
import { useCountUp } from '@/hooks/use-count-up';
import { cn } from '@/lib/utils';

/**
 * Cards enter in sequence rather than all at once, which reads as the page
 * assembling itself instead of flashing. The delay is capped so a long list
 * never leaves the viewer waiting.
 */
export function stagger(index: number) {
  return { animationDelay: `${Math.min(index * 40, 240)}ms` } as const;
}

export const ENTER = 'animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards';

export function StatCard({
  label,
  value,
  /** Renders `value` as money rather than a plain count. */
  money,
  /**
   * Formats the settled number instead of printing it plainly. For values that
   * are not really counts -- minutes, say -- rounding to a whole unit states
   * something untrue.
   */
  formatValue,
  icon: Icon,
  to,
  hint,
  tone = 'default',
  index = 0,
  compact = false,
}: {
  label: string;
  value: number | undefined;
  money?: boolean;
  formatValue?: (value: number) => string;
  icon: ComponentType<{ className?: string }>;
  /** Makes the whole card a link. "The cards should be clickable." */
  to?: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'brand' | 'success';
  index?: number;
  /** The Analytics row's size: a smaller figure and tighter padding. */
  compact?: boolean;
}) {
  const settled = useCountUp(value ?? 0);
  const display =
    value === undefined
      ? '—'
      : money
        ? formatCents(settled)
        : (formatValue?.(settled) ?? String(settled));

  const toneClass = {
    default: '',
    warning: 'text-warning-foreground dark:text-warning',
    brand: 'text-brand-700 dark:text-brand-300',
    success: 'text-success',
  }[tone];

  // Deliberately tight. These cards are read at a glance and a dozen of them
  // share a screen, so every line that is not a number or a word about the
  // number is pushing the next card off the fold: the icon shrank, the "View"
  // row went (the whole card is the link, and the arrow says so on hover), and
  // the figure sits straight under its label.
  const body = (
    <CardContent className={compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-[11px] font-medium tracking-wide uppercase">
          {label}
        </p>
        <span className={cn('shrink-0', toneClass || 'text-muted-foreground/70')}>
          <Icon className="size-4" />
        </span>
      </div>

      <p
        className={cn(
          'font-display font-semibold tabular-nums',
          compact ? 'mt-0.5 text-xl' : 'mt-1 text-2xl',
          toneClass,
        )}
      >
        {display}
        {to && (
          <ArrowUpRightIcon className="text-muted-foreground/0 group-hover:text-primary ml-1 inline size-3.5 align-super transition-colors" />
        )}
      </p>

      {hint && <p className="text-muted-foreground mt-0.5 text-xs leading-snug">{hint}</p>}
    </CardContent>
  );

  if (!to) {
    return (
      // h-full like the linked form, so a row mixing the two lines up.
      <Card className={cn('h-full py-0', ENTER)} style={stagger(index)}>
        {body}
      </Card>
    );
  }

  return (
    <Link to={to} className={cn('group block', ENTER)} style={stagger(index)}>
      <Card className="hover:border-primary/40 h-full py-0 transition-all hover:-translate-y-0.5 hover:shadow-md">
        {body}
      </Card>
    </Link>
  );
}

/** A titled block of dashboard content, with an optional link to the full view. */
export function Panel({
  title,
  action,
  children,
  index = 0,
  className,
}: {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <Card className={cn('py-0', ENTER, className)} style={stagger(index)}>
      <CardContent className="px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action && (
            <Link
              to={action.to}
              className="text-muted-foreground hover:text-primary text-xs transition-colors"
            >
              {action.label} →
            </Link>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}

/**
 * A titled band of the dashboard (Phase 21): Analytics, Tutoring Sessions,
 * Progress, Recent Activity. A heading and an optional link, over content
 * that brings its own cards -- unlike Panel, which is itself one card.
 */
export function DashboardSection({
  title,
  action,
  children,
  index = 0,
}: {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
  index?: number;
}) {
  const id = `section-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;

  return (
    <section aria-labelledby={id} className={cn('min-w-0', ENTER)} style={stagger(index)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 id={id} className="font-display text-base font-semibold">
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="text-muted-foreground hover:text-primary text-xs transition-colors"
          >
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
