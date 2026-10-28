import type { ReactNode } from 'react';
import { LoaderCircleIcon, ScanTextIcon, TriangleAlertIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MathText } from '@/features/question-bank/math-text';
import type { LineState } from './use-line-reader';

// Phase 54: what was read, beside the canvas, line by line. Each row says
// "I read: …" for its line, typeset; a reading that is not plain maths is
// shown only where `showNonMath` is set (the lab), never to a student -- no
// sentence a model wrote reaches a child that way (AI-13's third rule).

export function ReadingPanel({
  lines,
  source,
  highlighted,
  onHighlight,
  renderActions,
  showNonMath = false,
  className,
}: {
  lines: LineState[];
  source: { provider: string; model: string } | null;
  /** The line the reader is pointing at, by index; the canvas marks it too. */
  highlighted: number | null;
  onHighlight: (index: number | null) => void;
  /** What the lab adds under each line: confirm, fix, the picture. */
  renderActions?: (state: LineState) => ReactNode;
  showNonMath?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn('py-0', className)} data-testid="reading-panel">
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScanTextIcon className="text-muted-foreground size-4" aria-hidden />
          <h2 className="font-medium">What I read</h2>
          {source && (
            <Badge variant="secondary" className="ml-auto" data-testid="reading-source">
              {source.provider === 'fake' ? 'Fake reader' : source.model}
            </Badge>
          )}
        </div>
        {source?.provider === 'fake' && (
          <p className="text-muted-foreground text-xs">
            The fake reader cannot see: it reads each line as its number of strokes. Real reading runs on production, or
            locally with AI_PROVIDER=anthropic and a key in apps/api/.dev.vars.
          </p>
        )}

        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">Write a step on the page. Each line is read once the pen rests.</p>
        ) : (
          <ol className="grid gap-2" aria-label="Lines read">
            {lines.map((state) => (
              <ReadingRow
                key={state.line.key}
                state={state}
                highlighted={highlighted === state.line.index}
                onHighlight={onHighlight}
                showNonMath={showNonMath}
                actions={renderActions?.(state)}
              />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function ReadingRow({
  state,
  highlighted,
  onHighlight,
  showNonMath,
  actions,
}: {
  state: LineState;
  highlighted: boolean;
  onHighlight: (index: number | null) => void;
  showNonMath: boolean;
  actions: ReactNode;
}) {
  const { line, reading, previous, pending } = state;
  const shown = reading ?? previous;
  const number = line.index + 1;

  return (
    <li
      data-testid={`reading-line-${number}`}
      className={cn(
        'grid gap-1.5 rounded-lg border p-2.5 transition-colors',
        highlighted ? 'border-primary bg-primary/5' : 'border-border',
      )}
      onPointerEnter={() => onHighlight(line.index)}
      onPointerLeave={() => onHighlight(null)}
    >
      <div className="flex items-start gap-2">
        <span
          className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
          aria-label={`Line ${number}`}
        >
          {number}
        </span>
        <div className={cn('min-w-0 flex-1 text-base', !reading && 'opacity-60')} data-testid={`reading-text-${number}`}>
          {shown?.status === 'read' && shown.latex !== null ? (
            shown.is_math || showNonMath ? (
              <span className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="text-muted-foreground text-xs">I read:</span>
                {shown.is_math ? (
                  <MathText text={`$${shown.latex}$`} />
                ) : (
                  <code className="bg-muted rounded px-1 text-sm break-all">{shown.latex}</code>
                )}
              </span>
            ) : (
              <span className="text-muted-foreground text-sm">Read, but not as maths.</span>
            )
          ) : shown?.status === 'unreadable' ? (
            <span className="text-muted-foreground text-sm">I could not read this line.</span>
          ) : shown?.status === 'failed' ? (
            <span className="text-destructive text-sm">{shown.error?.message ?? 'The line could not be read.'}</span>
          ) : (
            <span className="text-muted-foreground text-sm">Waiting for the pen to rest…</span>
          )}
        </div>
        {pending ? (
          <LoaderCircleIcon className="text-muted-foreground size-4 shrink-0 animate-spin" aria-label="Reading" />
        ) : (
          reading?.status === 'read' &&
          reading.confidence !== null && (
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums" title="The reader's own confidence">
              {Math.round(reading.confidence * 100)}%
            </span>
          )
        )}
      </div>
      {showNonMath && reading?.status === 'read' && !reading.is_math && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <TriangleAlertIcon className="size-3.5" aria-hidden /> Not plain maths: a student would not be shown this reading.
        </p>
      )}
      {actions}
    </li>
  );
}
