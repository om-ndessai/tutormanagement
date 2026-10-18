import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeftIcon, EraserIcon, FileTextIcon, PenLineIcon, Trash2Icon, Undo2Icon } from 'lucide-react';
import {
  REVIEW_LIMITS,
  REVIEW_PAGE,
  formatRelativeTime,
  formatStroke,
  levelLabel,
  parseStroke,
  type CanvasReview,
  type CanvasStroke,
} from '@tmi/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
import {
  canvasAssessmentPdfUrl,
  useCanvasAssessmentSummary,
  useCanvasReview,
  useFinishCanvasReview,
  useReopenCanvasReview,
  useSaveCanvasReview,
} from './api';
import { DrawingCanvas, pageSize, type CanvasTool } from './drawing-canvas';
import { usePdfPageImages } from './use-pdf-pages';

// Phase 40: the tutor reviews a submitted assessment online. The submitted
// PDF's pages, each with a layer of the tutor's red ink and a note, and an
// overall comment; no scoring yet (owner, 2026-10-18). The draft saves itself
// as the tutor works; "Save as reviewed" writes the reviewed PDF, which the
// student, their parents, their tutors and the admins can then read. Only the
// student's current tutors and the admins come here (R17).

/** The tutor's pen, in PDF points: a firm red line on the page. */
const REVIEW_PEN = 2;
const AUTOSAVE_MS = 1500;

type Ink = Record<string, CanvasStroke[]>;

function inkFrom(review: CanvasReview): Ink {
  return Object.fromEntries(
    review.ink.map((page) => [
      page.question_id,
      page.strokes.map((text) => parseStroke(text, REVIEW_PAGE)).filter((s): s is CanvasStroke => s !== null),
    ]),
  );
}

export function ReviewAssessmentPage() {
  const { id = '' } = useParams();
  const summary = useCanvasAssessmentSummary(id);
  const review = useCanvasReview(id);
  const assessment = summary.data?.data;

  if (summary.isPending || (assessment?.can_review && review.isPending)) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (!assessment || !assessment.can_review || !review.data) {
    return (
      <Card className="py-0">
        <CardContent className="grid gap-3 p-6 text-sm">
          <p>Reviewing an assessment is for the student’s tutors and the office.</p>
          {assessment?.reviewed_at && (
            <Button asChild className="w-fit">
              <Link to={`/assessments/${id}/pdf?kind=reviewed`}>Open the review</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-fit">
            <Link to="/assessments">Back to Assessment</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <ReviewEditor
      id={id}
      review={review.data.data}
      title={`${assessment.student_name} · ${levelLabel(assessment.level_id)}`}
    />
  );
}

function ReviewEditor({ id, review, title }: { id: string; review: CanvasReview; title: string }) {
  const navigate = useNavigate();
  const images = usePdfPageImages(canvasAssessmentPdfUrl(id));
  const save = useSaveCanvasReview(id);
  const finish = useFinishCanvasReview(id);
  const reopen = useReopenCanvasReview(id);

  const [final, setFinal] = useState(review.status === 'final');
  const [comment, setComment] = useState(review.comment);
  const [notes, setNotes] = useState<Record<string, string>>(review.notes);
  const [ink, setInk] = useState<Ink>(() => inkFrom(review));
  const [history, setHistory] = useState<Record<string, CanvasStroke[][]>>({});
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [confirming, setConfirming] = useState(false);
  // Whether the review exists on the server yet: finishing needs one, even an empty one.
  const [hasRow, setHasRow] = useState(review.status !== 'none');
  const latest = useRef({ comment, notes, ink });
  latest.current = { comment, notes, ink };

  async function flush(): Promise<boolean> {
    setSaveState('saving');
    try {
      const { comment: c, notes: n, ink: k } = latest.current;
      await save.mutateAsync({
        comment: c,
        notes: n,
        ink: Object.entries(k).map(([question_id, strokes]) => ({
          question_id,
          strokes: strokes.map(formatStroke),
        })),
      });
      setDirty(false);
      setHasRow(true);
      setSaveState('saved');
      return true;
    } catch (caught) {
      setSaveState('failed');
      if (caught instanceof ApiRequestError) toast.error(caught.message);
      return false;
    }
  }

  // The draft saves itself a moment after the tutor stops.
  useEffect(() => {
    if (!dirty || final) return;
    const timer = setTimeout(() => void flush(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
    // flush reads the latest state through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, comment, notes, ink, final]);

  function touch() {
    setDirty(true);
  }

  function changeInk(questionId: string, next: CanvasStroke[]) {
    setHistory((h) => ({
      ...h,
      [questionId]: [...(h[questionId] ?? []), ink[questionId] ?? []].slice(-50),
    }));
    setInk((k) => ({ ...k, [questionId]: next }));
    touch();
  }

  function undo(questionId: string) {
    const past = history[questionId] ?? [];
    const previous = past.at(-1);
    if (!previous) return;
    setHistory((h) => ({ ...h, [questionId]: past.slice(0, -1) }));
    setInk((k) => ({ ...k, [questionId]: previous }));
    touch();
  }

  async function saveAsReviewed() {
    if ((dirty || !hasRow) && !(await flush())) return;
    try {
      await finish.mutateAsync();
      toast.success('Saved as reviewed. The student and their family can now read it.');
      navigate(`/assessments/${id}/pdf?kind=reviewed`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not save the review.');
    }
  }

  async function reopenReview() {
    try {
      await reopen.mutateAsync();
      setFinal(false);
      toast.success('Review reopened. The family no longer sees it until it is saved as reviewed again.');
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not reopen the review.');
    }
  }

  return (
    <div className="grid gap-4" data-testid="review-editor">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/assessments">
              <ArrowLeftIcon /> Assessment
            </Link>
          </Button>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            Review: {title}
            {final ? <Badge>Reviewed</Badge> : <Badge variant="secondary">Draft</Badge>}
          </h1>
          <p className="text-muted-foreground text-sm" data-testid="review-save-state">
            {final
              ? `Saved as reviewed${review.finished_at ? ` ${formatRelativeTime(review.finished_at)}` : ''}. Reopen it to change it.`
              : saveState === 'saving'
                ? 'Saving…'
                : saveState === 'failed'
                  ? 'Not saved yet. It will try again as you work.'
                  : dirty
                    ? 'Changes not saved yet…'
                    : 'Draft saved. Only the student’s tutors and the office see it until it is saved as reviewed.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={`/assessments/${id}/pdf`}>
              <FileTextIcon /> Submitted PDF
            </Link>
          </Button>
          {final ? (
            <>
              <Button asChild size="sm">
                <Link to={`/assessments/${id}/pdf?kind=reviewed`}>Open the review</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => void reopenReview()} disabled={reopen.isPending}>
                Reopen review
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={finish.isPending}
              data-testid="review-finish"
            >
              Save as reviewed
            </Button>
          )}
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="grid gap-2 p-5">
          <Label htmlFor="review-comment">Overall comment</Label>
          <textarea
            id="review-comment"
            data-testid="review-comment"
            value={comment}
            disabled={final}
            maxLength={REVIEW_LIMITS.commentChars}
            onChange={(event) => {
              setComment(event.target.value);
              touch();
            }}
            rows={3}
            placeholder="What went well, and what to work on next."
            className="border-input bg-background focus-visible:ring-ring min-h-20 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-60"
          />
        </CardContent>
      </Card>

      {!final && (
        <div
          className="bg-background/80 sticky top-14 z-10 flex flex-wrap items-center gap-2 py-2 backdrop-blur"
          role="toolbar"
          aria-label="Marking tools"
        >
          <Button
            size="sm"
            variant={tool === 'pen' ? 'default' : 'outline'}
            onClick={() => setTool('pen')}
            aria-pressed={tool === 'pen'}
          >
            <PenLineIcon /> Red pen
          </Button>
          <Button
            size="sm"
            variant={tool === 'eraser' ? 'default' : 'outline'}
            onClick={() => setTool('eraser')}
            aria-pressed={tool === 'eraser'}
          >
            <EraserIcon /> Eraser
          </Button>
          <span className="text-muted-foreground text-xs">
            Mark up any page. No scores: say what you see in the notes.
          </span>
        </div>
      )}

      {images.state === 'error' && <p className="text-destructive text-sm">The submitted PDF could not be shown.</p>}
      {images.state === 'loading' && <Skeleton className="h-[70vh] w-full" />}

      {images.state === 'ready' &&
        review.questions.map((question, index) => {
          const image = images.pages.find((page) => page.number === question.pdf_page);
          const strokes = ink[question.id] ?? [];
          return (
            <Card key={question.id} className="py-0" data-testid={`review-page-${index + 1}`}>
              <CardContent className="grid gap-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-medium">Question {index + 1}</h2>
                  {!final && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => undo(question.id)}
                        disabled={(history[question.id]?.length ?? 0) === 0}
                      >
                        <Undo2Icon /> Undo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changeInk(question.id, [])}
                        disabled={strokes.length === 0}
                      >
                        <Trash2Icon /> Clear marks
                      </Button>
                    </div>
                  )}
                </div>
                {image && (
                  <div className="relative mx-auto w-full max-w-[min(100%,calc((100dvh-10rem)*0.773))] overflow-hidden rounded-md border bg-white">
                    <img
                      src={image.src}
                      alt={`Question ${index + 1} as submitted`}
                      className="block w-full select-none"
                      draggable={false}
                    />
                    <DrawingCanvas
                      variant="overlay"
                      size={REVIEW_PAGE}
                      penWidth={REVIEW_PEN}
                      strokes={strokes}
                      tool={final ? 'pen' : tool}
                      className={cn(final && 'pointer-events-none')}
                      label={`Your marks on question ${index + 1}`}
                      onStroke={(stroke) => {
                        if (pageSize([...strokes, stroke]) > REVIEW_LIMITS.numbersPerPage) {
                          toast.error('This page holds as much marking as a review can keep.');
                          return;
                        }
                        changeInk(question.id, [...strokes, stroke]);
                      }}
                      onErase={(hit) =>
                        changeInk(
                          question.id,
                          strokes.filter((_, i) => !hit.includes(i)),
                        )
                      }
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor={`review-note-${index + 1}`}>Note on question {index + 1}</Label>
                  <textarea
                    id={`review-note-${index + 1}`}
                    data-testid={`review-note-${index + 1}`}
                    value={notes[question.id] ?? ''}
                    disabled={final}
                    maxLength={REVIEW_LIMITS.noteChars}
                    onChange={(event) => {
                      setNotes((n) => ({
                        ...n,
                        [question.id]: event.target.value,
                      }));
                      touch();
                    }}
                    rows={2}
                    className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 disabled:opacity-60"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this as reviewed?</AlertDialogTitle>
            <AlertDialogDescription>
              The reviewed PDF is written with your marks, notes and comment, and the student, their parents, their
              tutors and the office can then read it. You can reopen it later to change it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep reviewing</AlertDialogCancel>
            <AlertDialogAction onClick={() => void saveAsReviewed()} data-testid="review-finish-confirm">
              Save as reviewed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
