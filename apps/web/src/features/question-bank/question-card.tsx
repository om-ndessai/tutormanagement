import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckIcon, PencilIcon, RotateCcwIcon, ScanSearchIcon, XIcon } from 'lucide-react';
import {
  QUESTION_DIFFICULTY_LABELS,
  QUESTION_STATUS_LABELS,
  checkAnswer,
  checkProblems,
  type Question,
  type QuestionStatus,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiRequestError } from '@/lib/api-client';
import { cn, formatTimestamp } from '@/lib/utils';
import { useCheckQuestions, useQuestionAction } from './api';
import { MathText } from './math-text';
import { QuestionEditDialog } from './question-edit-dialog';

const STATUS_CLASS: Record<QuestionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  checked: 'bg-primary/10 text-primary',
  flagged: 'bg-destructive/10 text-destructive',
  approved: 'bg-success/15 text-success',
  retired: 'bg-muted text-muted-foreground line-through',
};

export function StatusBadge({ status }: { status: QuestionStatus }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', STATUS_CLASS[status])}>
      {QUESTION_STATUS_LABELS[status]}
    </Badge>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.';
}

/** Each check, passed or not, so a reviewer sees what was verified as well as what failed. */
function CheckList({ question }: { question: Question }) {
  const { lint, solve } = question.checks;
  const rows: { ok: boolean; text: ReactNode }[] = [
    {
      ok: lint.length === 0,
      text: lint.length === 0 ? 'Code checks passed (form, choices, exact answer, no near-copy).' : lint.join(' '),
    },
  ];
  if (question.compute) {
    rows.push({ ok: !lint.some((l) => l.includes('calculation')), text: `Answer computed exactly from ${question.compute}.` });
  }
  if (solve) {
    rows.push(
      {
        ok: solve.agreed,
        // The answer may be a choice with maths in it.
        text: (
          <>
            Solved blind: <MathText text={solve.answer} />, which {solve.agreed ? 'matches' : 'does NOT match'}.
          </>
        ),
      },
      { ok: solve.single_answer, text: solve.single_answer ? 'One defensible answer.' : 'More than one defensible answer.' },
      { ok: solve.aligned, text: solve.aligned ? 'Tests this standard.' : 'Does not test this standard.' },
      { ok: solve.grade_appropriate, text: solve.grade_appropriate ? 'Suits the grade.' : 'Does not suit the grade.' },
      { ok: solve.error_free, text: solve.error_free ? 'No errors found.' : 'An error was found.' },
    );
  } else if (question.status !== 'approved' && question.status !== 'retired') {
    rows.push({ ok: false, text: 'Not yet solved blind.' });
  }

  return (
    <ul className="grid gap-1 text-xs" aria-label="Checks">
      {rows.map((row, index) => (
        <li key={index} className={cn('flex items-start gap-1.5', row.ok ? 'text-muted-foreground' : 'text-destructive')}>
          {row.ok ? <CheckIcon className="text-success mt-px size-3.5 shrink-0" /> : <XIcon className="mt-px size-3.5 shrink-0" />}
          <span>{row.text}</span>
        </li>
      ))}
      {solve?.issues && <li className="text-destructive pl-5">Solver’s note: {solve.issues}</li>}
    </ul>
  );
}

/**
 * One question as a reviewer reads it: rendered, the key marked, the worked
 * solution, every check, and the actions its status allows. Approve is offered
 * only once every check has passed (`checked`); the server holds the same rule.
 */
export function QuestionCard({ question, autoFocus }: { question: Question; autoFocus?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [showWork, setShowWork] = useState(false);
  const check = useCheckQuestions();
  const action = useQuestionAction();
  const busy = check.isPending || action.isPending;
  const problems = checkProblems(question.checks);

  const run = (kind: 'approve' | 'retire' | 'restore') =>
    action.mutate(
      { id: question.id, action: kind },
      {
        onSuccess: () => toast.success(kind === 'approve' ? 'Approved.' : kind === 'retire' ? 'Retired.' : 'Restored: check it again.'),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );

  return (
    <Card className="py-0" data-testid="question-card" data-status={question.status}>
      <CardContent className="grid gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusBadge status={question.status} />
          <Badge variant="secondary">{QUESTION_DIFFICULTY_LABELS[question.difficulty]}</Badge>
          <Badge variant="secondary">{question.kind === 'choice' ? 'Multiple choice' : 'Number answer'}</Badge>
          {question.skill && <span className="text-muted-foreground">{question.skill}</span>}
          {question.status === 'flagged' && problems.length > 0 && (
            <span className="text-destructive">{problems.length === 1 ? '1 problem' : `${problems.length} problems`}</span>
          )}
        </div>

        <p className="text-base leading-relaxed" data-testid="question-stem">
          <MathText text={question.stem} />
        </p>

        {question.kind === 'choice' ? (
          <ol className="grid gap-1.5 sm:grid-cols-2" aria-label="Choices">
            {question.choices.map((choice, index) => {
              const key = checkAnswer(question, choice);
              return (
                <li
                  key={index}
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                    key ? 'border-success bg-success/10 font-medium' : 'border-border',
                  )}
                >
                  <span className="text-muted-foreground w-4 shrink-0">{String.fromCharCode(65 + index)}</span>
                  <MathText text={choice} />
                  {key && <CheckIcon className="text-success ml-auto size-4" aria-label="The answer" />}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm">
            Answer: <span className="font-semibold" data-testid="question-answer"><MathText text={question.answer} /></span>
          </p>
        )}

        <div className="bg-muted/50 rounded-md px-3 py-2 text-sm">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Solution</span>
          <p className="mt-1">
            <MathText text={question.solution} />
          </p>
        </div>

        <CheckList question={question} />

        {question.checks.solve?.work && (
          <div className="text-xs">
            <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => setShowWork((v) => !v)}>
              {showWork ? 'Hide' : 'Show'} the solver’s working
            </button>
            {showWork && (
              <p className="text-muted-foreground mt-1">
                <MathText text={question.checks.solve.work} />
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {question.status === 'checked' && (
            <Button size="sm" disabled={busy} onClick={() => run('approve')} autoFocus={autoFocus}>
              <CheckIcon /> Approve
            </Button>
          )}
          {(question.status === 'draft' || question.status === 'flagged' || question.status === 'checked') && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                check.mutate([question.id], {
                  onSuccess: (result) => {
                    const after = result.data[0];
                    if (after?.status === 'checked') toast.success('Every check passed.');
                    else toast.warning('Flagged: see the checks.');
                  },
                  onError: (error) => toast.error(errorMessage(error)),
                })
              }
            >
              <ScanSearchIcon /> {check.isPending ? 'Solving…' : question.checks.solve ? 'Check again' : 'Solve blind'}
            </Button>
          )}
          {question.status !== 'retired' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditing(true)}>
              <PencilIcon /> Edit
            </Button>
          )}
          {question.status === 'retired' ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run('restore')}>
              <RotateCcwIcon /> Restore
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => run('retire')}>
              <XIcon /> Retire
            </Button>
          )}
          <span className="text-muted-foreground ml-auto text-xs">
            {question.status === 'approved' && question.reviewed_by_name
              ? `Approved by ${question.reviewed_by_name}, ${formatTimestamp(question.reviewed_at, '')}`
              : question.source === 'manual'
                ? 'Edited by hand'
                : 'Written by Claude'}
          </span>
        </div>
      </CardContent>
      {editing && <QuestionEditDialog question={question} onClose={() => setEditing(false)} />}
    </Card>
  );
}
