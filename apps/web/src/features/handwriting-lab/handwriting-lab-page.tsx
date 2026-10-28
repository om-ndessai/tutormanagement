import { useState } from 'react';
import { toast } from 'sonner';
import {
  CheckIcon,
  EraserIcon,
  ImageIcon,
  PenLineIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  Undo2Icon,
  WandSparklesIcon,
} from 'lucide-react';
import {
  CANVAS_LIMITS,
  HANDWRITING_SAMPLE_CATEGORIES,
  HANDWRITING_SAMPLE_CATEGORY_LABELS,
  SYNTHETIC_LINES,
  formatStroke,
  writeLine,
  type CanvasStroke,
  type HandwritingSampleCategory,
} from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { DrawingCanvas, pageSize, type CanvasTool } from '@/features/canvas-assessments/drawing-canvas';
import { MathText } from '@/features/question-bank/math-text';
import { errorMessage } from '@/features/question-bank/question-card';
import { readHandwriting, useSaveHandwritingSample } from './api';
import { ReadingPanel } from './reading-panel';
import { SamplesCard } from './samples-card';
import { useLineReader, type LineState } from './use-line-reader';

// Phase 54 (AI-13 stage 0): the Handwriting lab. A platform admin writes maths
// on the canvas, one step per line; each line is read on its own, blind, and
// what was read appears beside the canvas. Confirming or correcting a reading
// saves the line as a sample, and the samples are the corpus the reader is
// measured against (`npm run handwriting:eval`). Adults' handwriting only: no
// child's work is read until consent for AI processing exists (AG1).

/** The page's faint rules: one step a line, eight lines (every 100 units of the 800-unit page). */
const RULE_SPACING = 100;
const RULES = CANVAS_LIMITS.height / RULE_SPACING;

/** The first ruled line with no ink on it, as a baseline to write on, or null when the page is full. */
function freeBaseline(strokes: readonly CanvasStroke[]): number | null {
  for (let rule = 1; rule <= RULES; rule += 1) {
    const top = (rule - 1) * RULE_SPACING;
    const bottom = rule * RULE_SPACING;
    const used = strokes.some((stroke) => {
      for (let i = 1; i < stroke.points.length; i += 2) {
        if (stroke.points[i]! > top && stroke.points[i]! < bottom) return true;
      }
      return false;
    });
    if (!used) return bottom - 24;
  }
  return null;
}

export function HandwritingLabPage() {
  const [strokes, setStrokes] = useState<CanvasStroke[]>([]);
  const [history, setHistory] = useState<CanvasStroke[][]>([]);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [category, setCategory] = useState<HandwritingSampleCategory>('clear');
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [synthetic, setSynthetic] = useState(0);
  /** Line keys saved as samples, so a line is not saved twice by accident. */
  const [saved, setSaved] = useState<Record<string, true>>({});
  const reader = useLineReader(strokes, { read: readHandwriting, includeImage: true });

  function change(next: CanvasStroke[]) {
    setHistory((h) => [...h, strokes].slice(-50));
    setStrokes(next);
  }

  function addStrokes(added: CanvasStroke[]) {
    const next = [...strokes, ...added];
    if (next.length > CANVAS_LIMITS.strokesPerPage || pageSize(next) > CANVAS_LIMITS.numbersPerPage) {
      toast.error('The page is full. Clear it to write more.');
      return;
    }
    change(next);
  }

  function writeSyntheticLine() {
    const baseline = freeBaseline(strokes);
    if (baseline === null) {
      toast.error('Every line of the page has writing. Clear it to write more.');
      return;
    }
    const line = SYNTHETIC_LINES[synthetic % SYNTHETIC_LINES.length]!;
    setSynthetic((n) => n + 1);
    addStrokes(writeLine(line.truth, { x: 40, baseline, size: 44, seed: Date.now() % 100_000, mess: 0.4 }));
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Handwriting lab"
        description="Write maths one step per line. Each line is read on its own, without the question or the answer, and what was read appears beside the page. Confirm or correct a reading to keep the line as a sample: the samples measure the reader before any student's work is read. Adults' handwriting only."
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 gap-3">
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Writing tools">
            <Button size="sm" variant={tool === 'pen' ? 'default' : 'outline'} onClick={() => setTool('pen')} aria-pressed={tool === 'pen'}>
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
            <Button
              size="sm"
              variant="outline"
              disabled={history.length === 0}
              onClick={() => {
                const previous = history.at(-1);
                if (!previous) return;
                setHistory((h) => h.slice(0, -1));
                setStrokes(previous);
              }}
            >
              <Undo2Icon /> Undo
            </Button>
            <Button size="sm" variant="outline" onClick={() => change([])} disabled={strokes.length === 0}>
              <Trash2Icon /> Clear page
            </Button>
            <Button size="sm" variant="outline" onClick={writeSyntheticLine} title="Writes a line in the synthetic hand: no pen needed">
              <WandSparklesIcon /> Write a sample line
            </Button>
            <Button size="sm" variant="outline" onClick={() => void reader.readNow()} disabled={reader.lines.length === 0}>
              <RefreshCwIcon /> Read now
            </Button>
          </div>

          <div
            className="bg-card relative mx-auto aspect-[5/4] w-full max-w-[min(100%,calc((100dvh-15rem)*1.25))] overflow-hidden rounded-lg border"
            data-testid="lab-page"
          >
            {/* The faint rules: one step per line. */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {Array.from({ length: RULES - 1 }, (_, i) => (
                <div key={i} className="bg-border absolute inset-x-0 h-px" style={{ top: `${((i + 1) / RULES) * 100}%` }} />
              ))}
            </div>
            {/* Where each line was found, numbered as in the panel. */}
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {reader.lines.map(({ line }) => (
                <div
                  key={line.key}
                  className={cn(
                    'absolute right-0 left-0 rounded-sm transition-colors',
                    highlighted === line.index ? 'bg-primary/10' : 'bg-transparent',
                  )}
                  style={{
                    top: `${(line.top / CANVAS_LIMITS.height) * 100}%`,
                    height: `${((line.bottom - line.top) / CANVAS_LIMITS.height) * 100}%`,
                  }}
                >
                  <span className="bg-muted text-muted-foreground absolute top-0 right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-semibold">
                    {line.index + 1}
                  </span>
                </div>
              ))}
            </div>
            <DrawingCanvas
              testId="lab-canvas"
              strokes={strokes}
              tool={tool}
              onStroke={(stroke) => addStrokes([stroke])}
              onErase={(hit) => change(strokes.filter((_, i) => !hit.includes(i)))}
              label="Handwriting lab page"
              className="relative mx-0 h-full max-w-none rounded-none border-0 bg-transparent"
            />
          </div>
        </div>

        <div className="grid gap-3 lg:sticky lg:top-4">
          <div className="grid gap-1.5">
            <Label htmlFor="sample-category">Saving lines as</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as HandwritingSampleCategory)}>
              <SelectTrigger id="sample-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HANDWRITING_SAMPLE_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {HANDWRITING_SAMPLE_CATEGORY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ReadingPanel
            lines={reader.lines}
            source={reader.source}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            showNonMath
            renderActions={(state) => (
              <LineActions
                state={state}
                strokes={strokes}
                category={category}
                model={reader.source ? (reader.source.provider === 'fake' ? 'fake' : reader.source.model) : null}
                saved={Boolean(saved[state.line.key])}
                onSaved={() => setSaved((s) => ({ ...s, [state.line.key]: true }))}
                onReadAgain={() => void reader.readAgain(state.line)}
              />
            )}
          />
        </div>
      </div>

      <SamplesCard />
    </div>
  );
}

/** Under each line in the lab: it was read right, or here is what it says; and the picture the reader saw. */
function LineActions({
  state,
  strokes,
  category,
  model,
  saved,
  onSaved,
  onReadAgain,
}: {
  state: LineState;
  strokes: readonly CanvasStroke[];
  category: HandwritingSampleCategory;
  model: string | null;
  saved: boolean;
  onSaved: () => void;
  onReadAgain: () => void;
}) {
  const save = useSaveHandwritingSample();
  const [fixing, setFixing] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const { reading, pending, line } = state;
  if (!reading || pending) return null;
  const number = line.index + 1;

  function keep(truth: string) {
    save.mutate(
      {
        strokes: line.strokes.map((index) => formatStroke(strokes[index]!)),
        truth,
        category,
        reading: reading!.status === 'read' ? reading!.latex : null,
        reading_status: reading!.status === 'failed' ? null : reading!.status,
        reading_model: reading!.status === 'failed' ? null : model,
      },
      {
        onSuccess: (sample) => {
          toast.success(sample.matched ? `Line ${number} saved: read right.` : `Line ${number} saved: misread.`);
          setFixing(null);
          onSaved();
        },
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  }

  if (saved) {
    return (
      <Badge variant="secondary" className="w-fit" data-testid={`line-saved-${number}`}>
        <CheckIcon /> Saved as a sample
      </Badge>
    );
  }

  // The picture is most use while correcting a misreading, so it is offered in both states.
  const pictureButton = reading.image ? (
    <Button
      size="icon"
      type="button"
      variant="ghost"
      className="size-8"
      onClick={() => setShowImage((v) => !v)}
      aria-pressed={showImage}
      aria-label="What the reader saw"
      title="What the reader saw"
      data-testid={`line-picture-${number}`}
    >
      <ImageIcon />
    </Button>
  ) : null;

  return (
    <div className="grid gap-2">
      {fixing === null ? (
        <div className="flex flex-wrap gap-1.5">
          {reading.status === 'read' && reading.latex !== null && (
            <Button size="sm" variant="outline" disabled={save.isPending} onClick={() => keep(reading.latex!)} data-testid={`line-right-${number}`}>
              <CheckIcon /> Right
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFixing(reading.latex ?? '')}
            data-testid={`line-fix-${number}`}
          >
            <PencilIcon /> {reading.status === 'read' ? 'Not what I wrote' : 'Say what it says'}
          </Button>
          {reading.status !== 'read' && (
            <Button size="sm" variant="ghost" onClick={onReadAgain}>
              <RefreshCwIcon /> Read again
            </Button>
          )}
          {pictureButton}
        </div>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (fixing.trim()) keep(fixing.trim());
          }}
        >
          <Label htmlFor={`truth-${number}`} className="text-xs">
            What line {number} says, in LaTeX (\frac{'{3}{4}'}, \times, x^{'{2}'})
          </Label>
          <Input
            id={`truth-${number}`}
            value={fixing}
            onChange={(event) => setFixing(event.target.value)}
            autoFocus
            className="font-mono text-sm"
            data-testid={`line-truth-${number}`}
          />
          {fixing.trim() && (
            <div className="text-sm">
              <MathText text={`$${fixing.trim()}$`} />
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" type="submit" disabled={save.isPending || !fixing.trim()} data-testid={`line-save-${number}`}>
              Save sample
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setFixing(null)}>
              Cancel
            </Button>
            {pictureButton}
          </div>
        </form>
      )}
      {showImage && reading.image && (
        <img
          src={reading.image}
          alt={`The picture of line ${number} the reader was given`}
          className="w-full rounded border"
          data-testid={`line-image-${number}`}
        />
      )}
    </div>
  );
}
