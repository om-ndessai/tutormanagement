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
  icon: Icon,
  to,
  hint,
  tone = 'default',
  index = 0,
}: {
  label: string;
  value: number | undefined;
  money?: boolean;
  icon: ComponentType<{ className?: string }>;
  /** Makes the whole card a link. "The cards should be clickable." */
  to?: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'brand' | 'success';
  index?: number;
}) {
  const settled = useCountUp(value ?? 0);
  const display = value === undefined ? '—' : money ? formatCents(settled) : String(settled);

  const toneClass = {
    default: '',
    warning: 'text-warning-foreground dark:text-warning',
    brand: 'text-brand-700 dark:text-brand-300',
    success: 'text-success',
  }[tone];

  const body = (
    <CardContent className="py-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          {label}
        </p>
        <Icon className="text-muted-foreground size-4 shrink-0" />
      </div>

      <p className={cn('font-display mt-2 text-3xl font-semibold tabular-nums', toneClass)}>
        {display}
      </p>

      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}

      {to && (
        <span className="text-muted-foreground group-hover:text-primary mt-2 flex items-center gap-1 text-xs transition-colors">
          View
          <ArrowUpRightIcon className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      )}
    </CardContent>
  );

  if (!to) {
    return (
      <Card className={ENTER} style={stagger(index)}>
        {body}
      </Card>
    );
  }

  return (
    <Link to={to} className={cn('group block', ENTER)} style={stagger(index)}>
      <Card className="hover:border-primary/40 h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
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
    <Card className={cn(ENTER, className)} style={stagger(index)}>
      <CardContent className="py-5">
        <div className="mb-4 flex items-baseline justify-between gap-2">
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
