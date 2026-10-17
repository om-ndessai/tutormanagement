import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { QUESTION_STATUSES, QUESTION_STATUS_LABELS, type QuestionStatus } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { NotificationsSwitch } from '@/features/organizations/notifications-switch';
import { cn } from '@/lib/utils';
import { useQuestionCoverage, useQuestions, useSetNeedsFigure } from './api';
import { QuestionCard, errorMessage } from './question-card';
import { describeProgress, useWriteQuestions } from './use-write-questions';

/** One standard's questions, by status, with "write more" and the figure switch. */
export function StandardPage() {
  const topicId = decodeURIComponent(useParams().topicId ?? '');
  const coverage = useQuestionCoverage();
  const topic = coverage.data?.data.flatMap((level) => level.topics.map((t) => ({ ...t, level: level.name }))).find(
    (t) => t.topic_id === topicId,
  );
  const questions = useQuestions({ topic_id: topicId }, Boolean(topicId));
  const all = questions.data?.data ?? [];
  const [filter, setFilter] = useState<QuestionStatus | 'all'>('all');
  const writer = useWriteQuestions();
  const figure = useSetNeedsFigure();

  const shown = all.filter((q) => (filter === 'all' ? q.status !== 'retired' : q.status === filter));
  const count = (status: QuestionStatus) => all.filter((q) => q.status === status).length;

  if (coverage.isSuccess && !topic) {
    return <p className="text-muted-foreground text-sm">That standard is not in the question bank.</p>;
  }

  return (
    <>
      <Link to="/platform/questions" className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeftIcon className="size-4" /> Question bank
      </Link>
      <PageHeader
        title={topic ? `${topic.code} · ${topic.name}` : 'Standard'}
        description={topic ? `${topic.level} · ${topic.unit ?? ''}. ${topic.description ?? ''}` : undefined}
        actions={
          <Button
            disabled={!topic || writer.running || topic.needs_figure}
            onClick={() => topic && void writer.run([{ topic_id: topic.topic_id, code: topic.code }])}
          >
            <SparklesIcon /> {writer.running ? 'Working…' : 'Write 8 questions'}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <NotificationsSwitch
            label="Needs a figure"
            checked={topic?.needs_figure ?? false}
            disabled={!topic || figure.isPending}
            onCheckedChange={(needs_figure) =>
              figure.mutate(
                { topicId, needs_figure },
                {
                  onSuccess: () =>
                    toast.success(needs_figure ? 'Left out of tests until figures are supported.' : 'Askable in text again.'),
                  onError: (error) => toast.error(errorMessage(error)),
                },
              )
            }
          />
          Needs a figure (left out of the test)
        </label>
      </div>

      {(writer.running || writer.progress.total > 0) && (
        <p className={cn('mb-4 text-sm', writer.progress.error ? 'text-destructive' : 'text-muted-foreground')} role="status">
          {describeProgress(writer.progress)}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Filter by status">
        {(['all', ...QUESTION_STATUSES] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            role="tab"
            aria-selected={filter === status}
            variant={filter === status ? 'default' : 'ghost'}
            onClick={() => setFilter(status)}
          >
            {status === 'all' ? `All (${all.filter((q) => q.status !== 'retired').length})` : `${QUESTION_STATUS_LABELS[status]} (${count(status)})`}
          </Button>
        ))}
      </div>

      <div className="grid gap-4">
        {shown.map((question) => (
          <QuestionCard key={question.id} question={question} />
        ))}
        {questions.isSuccess && shown.length === 0 && (
          <p className="text-muted-foreground text-sm">No questions here yet.</p>
        )}
      </div>
    </>
  );
}
