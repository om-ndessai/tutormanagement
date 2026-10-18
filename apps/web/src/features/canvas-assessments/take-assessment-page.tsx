import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EraserIcon, PenLineIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import {
  CANVAS_LIMITS,
  formatStroke,
  levelLabel,
  type CanvasAssessmentQuestion,
  type CanvasStroke,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { MathText } from '@/features/question-bank/math-text';
import { useCanvasAssessment, useSubmitCanvasAssessment } from './api';
import { DrawingCanvas, pageSize, type CanvasTool } from './drawing-canvas';

// Phase 38: taking an assessment. One question per page, written by hand, with
// nothing checked or marked; any page can be revisited and edited, and it can
// be submitted at any time. The work stays in this browser (saved as it goes,
// so a reload loses nothing) until it is submitted.

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

type Pages = Record<string, CanvasStroke[]>;
/** A multiple-choice question's selected choice, by position. */
type Choices = Record<string, number | null>;
interface Saved {
  pages: Pages;
  choices: Choices;
}

function storageKey(id: string): string {
  return `aimtrue.canvas-assessment.${id}`;
}

function loadSaved(id: string): Saved {
  try {
    const raw = localStorage.getItem(storageKey(id));
    const saved = raw ? (JSON.parse(raw) as Partial<Saved>) : {};
    return { pages: saved.pages ?? {}, choices: saved.choices ?? {} };
  } catch {
    return { pages: {}, choices: {} };
  }
}

function saveWork(id: string, saved: Saved): void {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(saved));
  } catch {
    // Private windows and full storage: the work is still in memory.
  }
}

function forgetPages(id: string): void {
  try {
    localStorage.removeItem(storageKey(id));
  } catch {
    // Nothing to do.
  }
}

export function TakeAssessmentPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const detail = useCanvasAssessment(id);
  const submit = useSubmitCanvasAssessment(id);

  const [pages, setPages] = useState<Pages>(() => loadSaved(id).pages);
  const [choices, setChoices] = useState<Choices>(() => loadSaved(id).choices);
  const [history, setHistory] = useState<Record<string, CanvasStroke[][]>>({});
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => saveWork(id, { pages, choices }), [id, pages, choices]);

  const assessment = detail.data?.data;
  const questions: CanvasAssessmentQuestion[] = useMemo(() => assessment?.questions ?? [], [assessment]);
  const question = questions[index];
  const strokes = (question && pages[question.id]) ?? [];
  // Unanswered: a multiple-choice question with nothing chosen, any other with nothing written.
  const unanswered = questions.filter((q) =>
    q.kind === 'choice' ? (choices[q.id] ?? null) === null : (pages[q.id]?.length ?? 0) === 0,
  ).length;

  if (detail.isPending) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!assessment || !assessment.questions || questions.length === 0) {
    return (
      <Card className="py-0">
        <CardContent className="grid gap-3 p-6 text-sm">
          <p>This assessment cannot be taken here: it has been submitted or discarded, or somebody else started it.</p>
          <Button asChild variant="outline" className="w-fit">
            <Link to="/assessments">Back to Assessment</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  /** Replaces the current page's strokes, keeping the old ones for Undo. */
  function change(next: CanvasStroke[]) {
    if (!question) return;
    setHistory((h) => ({ ...h, [question.id]: [...(h[question.id] ?? []), strokes].slice(-50) }));
    setPages((p) => ({ ...p, [question.id]: next }));
  }

  function addStroke(stroke: CanvasStroke) {
    if (strokes.length >= CANVAS_LIMITS.strokesPerPage || pageSize([...strokes, stroke]) > CANVAS_LIMITS.numbersPerPage) {
      toast.error('This page is full. Clear some writing to add more.');
      return;
    }
    change([...strokes, stroke]);
  }

  function undo() {
    if (!question) return;
    const past = history[question.id] ?? [];
    const previous = past.at(-1);
    if (!previous) return;
    setHistory((h) => ({ ...h, [question.id]: past.slice(0, -1) }));
    setPages((p) => ({ ...p, [question.id]: previous }));
  }

  async function send() {
    try {
      await submit.mutateAsync({
        pages: questions.map((q) => ({
          question_id: q.id,
          strokes: (pages[q.id] ?? []).map(formatStroke),
          choice: q.kind === 'choice' ? (choices[q.id] ?? null) : null,
        })),
      });
      forgetPages(id);
      toast.success('Submitted. The tutor gets a PDF of your answers.');
      navigate('/assessments');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not submit the assessment.');
    }
  }

  return (
    <div className="grid gap-4" data-testid="take-assessment">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Question {index + 1} of {questions.length}
            <Badge variant="secondary">Beta</Badge>
          </h1>
          <p className="text-muted-foreground text-sm">
            {assessment.student_name} · {levelLabel(assessment.level_id)} ·{' '}
            {question?.kind === 'choice'
              ? 'Choose your answer, and use the page below for your working.'
              : 'Write your working and your answer below.'}{' '}
            Nothing is marked until your tutor reviews it.
          </p>
        </div>
        <Button onClick={() => setConfirming(true)} disabled={submit.isPending} data-testid="assessment-submit">
          Submit
        </Button>
      </div>

      <nav className="flex flex-wrap gap-1.5" aria-label="Questions">
        {questions.map((q, i) => {
          const written = (pages[q.id]?.length ?? 0) > 0;
          const chosen = q.kind === 'choice' && (choices[q.id] ?? null) !== null;
          return (
            <Button
              key={q.id}
              size="sm"
              variant={i === index ? 'default' : 'outline'}
              className={cn('size-9 p-0', (written || chosen) && i !== index && 'border-primary text-primary')}
              aria-label={`Question ${i + 1}${written ? ', has writing' : ''}${chosen ? ', answered' : ''}`}
              aria-current={i === index ? 'page' : undefined}
              onClick={() => setIndex(i)}
            >
              {i + 1}
            </Button>
          );
        })}
      </nav>

      {question && (
        <Card className="py-0">
          <CardContent className="grid gap-3 p-5">
            <MathText text={question.stem} className="text-base leading-relaxed" />
            {question.kind === 'choice' && (
              <div role="radiogroup" aria-label="Your answer" className="grid gap-2 sm:grid-cols-2">
                {question.choices.map((choice, i) => {
                  const selected = (choices[question.id] ?? null) === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`assessment-choice-${LETTERS[i]}`}
                      // Choosing it again takes the choice back.
                      onClick={() => setChoices((c) => ({ ...c, [question.id]: selected ? null : i }))}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        'focus-visible:ring-ring outline-none focus-visible:ring-2',
                        selected ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {LETTERS[i]}
                      </span>
                      <MathText text={choice} />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Writing tools">
        <Button
          size="sm"
          variant={tool === 'pen' ? 'default' : 'outline'}
          onClick={() => setTool('pen')}
          aria-pressed={tool === 'pen'}
        >
          <PenLineIcon /> Pen
        </Button>
        <Button
          size="sm"
          variant={tool === 'eraser' ? 'default' : 'outline'}
          onClick={() => setTool('eraser')}
          aria-pressed={tool === 'eraser'}
        >
          <EraserIcon /> Eraser
        </Button>
        <Button size="sm" variant="outline" onClick={undo} disabled={(history[question?.id ?? '']?.length ?? 0) === 0}>
          <Undo2Icon /> Undo
        </Button>
        <Button size="sm" variant="outline" onClick={() => change([])} disabled={strokes.length === 0}>
          <Trash2Icon /> Clear page
        </Button>
      </div>

      {question && (
        <DrawingCanvas
          key={question.id}
          strokes={strokes}
          tool={tool}
          onStroke={addStroke}
          onErase={(hit) => change(strokes.filter((_, i) => !hit.includes(i)))}
          label={`Writing for question ${index + 1}`}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index === questions.length - 1}
        >
          Next
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered === 0
                ? 'Every question has an answer.'
                : `${unanswered} of ${questions.length} questions have no answer yet.`}{' '}
              Once submitted it cannot be changed, and your tutor gets a PDF of your answers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction onClick={() => void send()} data-testid="assessment-submit-confirm">
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
