import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, EraserIcon, PenLineIcon, XIcon } from 'lucide-react';
import { checkAnswer, guestSeries, type CanvasStroke, type GuestTile } from '@tmi/shared';

import { LogoLockup } from '@/components/brand/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DrawingCanvas, type CanvasTool } from '@/features/canvas-assessments/drawing-canvas';
import { MathText } from '@/features/question-bank/math-text';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { countEvent, flushEvents, useGuestPool } from './guest-api';
import { guestMemory } from './guest-store';
import { NudgeSheet, benefitsFor } from './nudge-sheet';
import { SignupSheet } from './signup-sheet';

/**
 * Phase 63 (P11): a guest's Assessment, entirely on the device. A few questions from the level's guest
 * pool, one page each, written on the canvas: a choice question answered by choosing, a number
 * question by typing the final number, the canvas for working. Marked on the device (`checkAnswer`);
 * the results redraw each page beside the key and the worked solution. No PDF is built and nothing is
 * stored or sent -- the PDF, a tutor's review and the progress are what an account adds.
 */
export function GuestAssessment({ tile }: { tile: GuestTile }) {
  const { config } = useAuth();
  const guest = config!.guest!;
  const pool = useGuestPool(guest.version, tile.level_id);
  const count = Math.min(tile.value, guest.settings.assessment_questions || tile.value);
  const questions = useMemo(
    () => guestSeries(pool.data?.data.questions ?? [], guestMemory.seen(tile.level_id)).slice(0, count),
    [pool.data, tile.level_id, count],
  );
  const [index, setIndex] = useState(0);
  const [pages, setPages] = useState<Record<string, CanvasStroke[]>>({});
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [finished, setFinished] = useState(false);
  const [offer, setOffer] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  useEffect(() => {
    if (questions.length > 0) countEvent({ name: 'tile_started', tile: tile.code, source: 'guest' });
  }, [questions.length, tile.code]);

  if (pool.isPending) return <Frame><p className="text-muted-foreground text-sm">Getting your assessment ready…</p></Frame>;
  if (questions.length === 0) return <Frame><p className="text-sm">This assessment is not available just now.</p></Frame>;

  const question = questions[index]!;
  const strokes = pages[question.id] ?? [];
  const marks = questions.map((q) => ({ q, given: answers[q.id] ?? null, right: answers[q.id] !== undefined && checkAnswer({ kind: q.kind, answer: q.answer }, answers[q.id]!) }));

  function finish() {
    setFinished(true);
    guestMemory.addSeen(tile.level_id, questions.map((q) => q.id));
    const score = marks.filter((m) => m.right).length;
    guestMemory.setBest(tile.code, score);
    countEvent({ name: 'assessment_finished', tile: tile.code, value: score });
    flushEvents();
  }

  const sheets = (
    <>
      <SignupSheet open={signingUp} onClose={() => setSigningUp(false)} />
      <NudgeSheet
        open={offer}
        headline="Keep this assessment"
        description="With a free account:"
        benefits={['A PDF of your work, kept for you', 'A tutor can review it and write back', ...benefitsFor(tile.level_id, guest.member_counts).slice(0, 2)]}
        onSignUp={() => {
          countEvent({ name: 'signup_started', source: 'results', tile: tile.code });
          setOffer(false);
          setSigningUp(true);
        }}
        onClose={() => setOffer(false)}
        closeLabel="Not now"
        shareLink={`${window.location.origin}/play/${tile.code}`}
      />
    </>
  );

  if (finished) {
    const score = marks.filter((m) => m.right).length;
    return (
      <Frame>
        <Card className="py-0" data-testid="guest-assessment-results">
          <CardContent className="grid gap-3 p-6">
            <h1 className="font-display text-2xl font-semibold" data-testid="guest-assessment-score">
              {score} of {questions.length} right
            </h1>
            <p className="text-muted-foreground text-sm">{tile.code} · {tile.words}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setOffer(true)} data-testid="guest-assessment-keep">
                Keep it: PDF and a tutor&apos;s review
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Back to quests</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        {marks.map(({ q, given, right }, i) => (
          <Card key={q.id} className="py-0">
            <CardContent className="grid gap-2 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium">
                {right ? <CheckIcon className="text-primary size-4" /> : <XIcon className="text-destructive size-4" />} Page {i + 1}
              </p>
              <MathText text={q.stem} />
              {(pages[q.id] ?? []).length > 0 && (
                <DrawingCanvas strokes={pages[q.id]!} tool="pen" onStroke={() => undefined} onErase={() => undefined} label={`Your working on page ${i + 1}`} className="pointer-events-none" />
              )}
              <p className="text-muted-foreground">
                Answer: <MathText text={q.answer} />
                {given !== null && !right && <> · yours: <MathText text={given} /></>}
              </p>
              <details>
                <summary className="cursor-pointer text-xs">How to solve it</summary>
                <MathText text={q.solution} className="mt-1 block" />
              </details>
            </CardContent>
          </Card>
        ))}
        {sheets}
      </Frame>
    );
  }

  return (
    <Frame right={<span className="text-muted-foreground text-sm">Page {index + 1} of {questions.length}</span>}>
      <Card className="py-0" data-testid="guest-assessment-page">
        <CardContent className="grid gap-3 p-6">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{tile.code}</span>
            {question.beta && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Beta</Badge>}
          </div>
          <MathText text={question.stem} className="text-lg leading-relaxed" />
          {question.kind === 'choice' ? (
            <div className="grid gap-2" role="radiogroup" aria-label="Your answer">
              {question.choices.map((choice, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={answers[question.id] === choice}
                  onClick={() => setAnswers({ ...answers, [question.id]: choice })}
                  className={cn('rounded-md border px-3 py-2 text-left text-sm', answers[question.id] === choice && 'border-primary bg-primary/10')}
                  data-testid={`guest-assessment-choice-${i}`}
                >
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}</span>
                  <MathText text={choice} />
                </button>
              ))}
            </div>
          ) : (
            <Input
              aria-label="Your final answer"
              placeholder="Your final answer"
              inputMode="decimal"
              value={answers[question.id] ?? ''}
              onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
            />
          )}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button variant={tool === 'pen' ? 'default' : 'outline'} size="sm" onClick={() => setTool('pen')}>
          <PenLineIcon /> Pen
        </Button>
        <Button variant={tool === 'eraser' ? 'default' : 'outline'} size="sm" onClick={() => setTool('eraser')}>
          <EraserIcon /> Eraser
        </Button>
      </div>
      <DrawingCanvas
        key={question.id}
        strokes={strokes}
        tool={tool}
        onStroke={(stroke) => setPages({ ...pages, [question.id]: [...strokes, stroke] })}
        onErase={(hit) => setPages({ ...pages, [question.id]: strokes.filter((_, i) => !hit.includes(i)) })}
        label={`Working for page ${index + 1}`}
      />
      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </Button>
        {index < questions.length - 1 ? (
          <Button onClick={() => setIndex(index + 1)} data-testid="guest-assessment-next">
            Next page
          </Button>
        ) : (
          <Button onClick={finish} data-testid="guest-assessment-finish">
            Finish and mark
          </Button>
        )}
      </div>
      {sheets}
    </Frame>
  );
}

function Frame({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="bg-background min-h-dvh">
      <header className="flex items-center gap-3 border-b px-4 py-3 sm:px-8">
        <Link to="/" aria-label="Home">
          <LogoLockup />
        </Link>
        <span className="ml-auto">{right}</span>
      </header>
      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-6">{children}</main>
    </div>
  );
}
