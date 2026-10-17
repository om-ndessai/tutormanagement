import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { useQuestionAction, useQuestions } from './api';
import { QuestionCard, errorMessage } from './question-card';

/**
 * The review queue: every checked question, one at a time, with keys for the
 * common moves -- A approve, R retire, N or → skip. Edit stays a button, since
 * a correction deserves the mouse and a second look.
 */
export function ReviewPage() {
  const queue = useQuestions({ status: 'checked' });
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

  const left = items.filter((q) => !skipped.includes(q.id)).length;

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
