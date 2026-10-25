import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { QUESTION_PAGE, useQuestionAction, useQuestionCoverage, useQuestions } from './api';
import { QuestionCard, errorMessage } from './question-card';

/**
 * The review queue: every checked question, one at a time, with keys for the
 * common moves -- A approve, R retire, N or → skip. Edit stays a button, since
 * a correction deserves the mouse and a second look.
 */
export function ReviewPage() {
  // Phase 51: ?suggested=1 reviews only what untrusted spaces suggested approving.
  const [params] = useSearchParams();
  const suggested = params.get('suggested') === '1';
  const queue = useQuestions(suggested ? { status: 'checked', suggested: 'true' } : { status: 'checked' });
  const coverage = useQuestionCoverage();
  const items = queue.data?.data ?? [];
  const [skipped, setSkipped] = useState<string[]>([]);
  const action = useQuestionAction();
  const current = items.find((q) => !skipped.includes(q.id)) ?? null;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!current || action.isPending) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [role="dialog"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'a' || key === 'r') {
        event.preventDefault();
        action.mutate(
          { id: current.id, action: key === 'a' ? 'approve' : 'retire' },
          {
            onSuccess: () => toast.success(key === 'a' ? 'Approved.' : 'Retired.'),
            onError: (error) => toast.error(errorMessage(error)),
          },
        );
      } else if (key === 'n' || event.key === 'ArrowRight') {
        event.preventDefault();
        setSkipped((list) => [...list, current.id]);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, action]);

  // The queue loads a page at a time; the count is the whole bank's.
  const waiting = coverage.data?.data.reduce((sum, level) => sum + level.topics.reduce((n, t) => n + t.checked, 0), 0);
  const left = (waiting ?? items.length) - skipped.length;

  // Approvals take questions out of the loaded page without a refetch (api.ts); ask for the next
  // page only when this one runs low and more are waiting -- once per page, so a page of skipped
  // questions does not refetch in a loop.
  const unskipped = items.filter((q) => !skipped.includes(q.id)).length;
  const askedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!queue.isSuccess || queue.isFetching || unskipped >= 10 || items.length >= (waiting ?? 0)) return;
    if (items.length >= QUESTION_PAGE) return;
    const page = items.map((q) => q.id).join();
    if (askedFor.current === page) return;
    askedFor.current = page;
    void queue.refetch();
  }, [queue, unskipped, items, waiting]);

  return (
    <>
      <Link to="/platform/questions" className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeftIcon className="size-4" /> Question bank
      </Link>
      <PageHeader
        title="Review"
        description="Read it as a student would: is it clear, is the marked answer right, is it fair for the grade? Keys: A approve · R retire · N skip."
      />
      {current ? (
        <div className="grid gap-3">
          <p className="text-muted-foreground text-sm" data-testid="review-position">
            {current.level_name} · <span className="text-foreground font-medium">{current.topic_code}</span> {current.topic_name} ·{' '}
            {left} left{skipped.length > 0 ? `, ${skipped.length} skipped` : ''}
          </p>
          <QuestionCard key={current.id} question={current} autoFocus />
        </div>
      ) : (
        queue.isSuccess && (
          <p className="text-muted-foreground text-sm" data-testid="review-empty">
            {skipped.length > 0 ? 'Only skipped questions are left.' : 'Nothing waiting for review.'}{' '}
            {skipped.length > 0 && (
              <button type="button" className="text-primary underline" onClick={() => setSkipped([])}>
                Go through them again
              </button>
            )}
          </p>
        )
      )}
    </>
  );
}
