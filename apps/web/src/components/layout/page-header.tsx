import type { ReactNode } from 'react';

/**
 * Title, blurb and actions.
 *
 * Stacked on phones and side by side from `sm` up. Letting both halves share a
 * row at every width sounds tidier, but flexbox shrinks them instead of
 * wrapping: the title collapsed to a couple of words and the blurb ran down
 * the page in a narrow column.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-4">
      <div className="min-w-0 sm:flex-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm text-pretty">{description}</p>
        )}
      </div>

      {/* min-w-0 so a long control can shrink instead of overflowing. */}
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
