import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

/**
 * Text with maths in `$...$`, the question bank's format (Phase 36). Plain
 * text stays React text; each maths span is KaTeX's own markup, which escapes
 * what it is given and runs nothing (`trust: false`). An unbalanced `$` is
 * shown as typed, and a span KaTeX cannot read is shown in red, so a reviewer
 * sees the problem rather than a silently dropped symbol.
 */
export function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const pieces = text.split('$');
    // An odd number of `$` leaves the last piece unclosed: keep it as text.
    if (pieces.length % 2 === 0) return [{ math: false, value: text }];
    return pieces.map((value, index) => ({ math: index % 2 === 1, value }));
  }, [text]);

  return (
    <span className={cn('whitespace-pre-wrap', className)}>
      {parts.map((part, index) =>
        part.math ? (
          <span
            key={index}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.value, {
                throwOnError: false,
                trust: false,
                strict: 'ignore',
                errorColor: 'var(--destructive)',
              }),
            }}
          />
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </span>
  );
}
