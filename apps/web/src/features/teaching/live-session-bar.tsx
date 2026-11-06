import { useEffect, useState } from 'react';
import { CheckCircle2Icon, Loader2Icon, PencilLineIcon, SquareIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SESSION_MODE_LABELS,
  elapsedSince,
  formatDuration,
  formatClockTime,
  formatStopwatch,
  type ActiveSession,
  type TutoringSession,
} from '@tmi/shared';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api-client';
import {
  useActiveSession,
  useCancelActiveSession,
  useStopSession,
  useUpdateActiveSession,
} from './api';
import { ProblemLines, refusalLines } from './record-lesson';
import { SessionFormDialog } from './session-form-dialog';

/** An instant as the clock time the reader is looking at. */
function formatInstantTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Ticks once a second, driven off the server's start instant rather than a local one. */
function useStopwatch(startedAt: string | undefined) {
  const [seconds, setSeconds] = useState(() => (startedAt ? elapsedSince(startedAt) : 0));

  useEffect(() => {
    if (!startedAt) return;

    setSeconds(elapsedSince(startedAt));
    const timer = window.setInterval(() => setSeconds(elapsedSince(startedAt)), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return seconds;
}

/**
 * A persistent bar shown wherever the tutor navigates while a lesson is
 * running, so it cannot be forgotten about on another screen.
 */
export function LiveSessionBar() {
  const { data } = useActiveSession();
  const active = data?.data.mine ?? null;

  // The lesson being stopped, held while the dialog is open: once recorded, the live lesson is gone but the
  // dialog stays to offer the write-up (Phase 75, JF30).
  const [stopping, setStopping] = useState<ActiveSession | null>(null);
  const [cancelling, setCancelling] = useState(false);

  return (
    <>
      {active && (
        <div
          role="status"
          className="border-primary/30 bg-primary/10 sticky top-14 z-30 border-b backdrop-blur-sm"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 lg:px-8">
            {/* A quiet pulse is enough to say "running" without being a distraction. */}
            <span className="relative flex size-2.5 shrink-0">
              <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-60" />
              <span className="bg-primary relative inline-flex size-2.5 rounded-full" />
            </span>

            <Stopwatch startedAt={active.started_at} />

            <span className="min-w-0 text-sm">
              <span className="font-medium">{active.student_name}</span>
              <span className="text-muted-foreground"> · {SESSION_MODE_LABELS[active.mode]}</span>
            </span>

            <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
              from {formatClockTime(active.rounded_start)}
            </Badge>

            {/* The limit is the tutor's safety net, so it should not be a
                surprise when it fires. */}
            <Badge variant="outline" className="hidden text-xs md:inline-flex">
              ends by {formatInstantTime(active.auto_stop_at)}
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" onClick={() => setStopping(active)} data-testid="live-stop">
                <SquareIcon className="fill-current" />
                Stop
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Discard this lesson"
                onClick={() => setCancelling(true)}
              >
                <XIcon />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mounted only while stopping: every page of the space carries this bar, for every reader. */}
      {stopping && <StopLessonFlow active={stopping} onClose={() => setStopping(null)} />}
      <CancelDialog open={cancelling} onOpenChange={setCancelling} />
    </>
  );
}

function Stopwatch({ startedAt }: { startedAt: string }) {
  const seconds = useStopwatch(startedAt);

  return (
    <span className="font-display text-lg font-semibold tabular-nums" aria-label="Elapsed time">
      {formatStopwatch(seconds)}
    </span>
  );
}

/** "12 min", ticking: how long the lesson has run, for Next up (Phase 75, JF30). */
export function RunningFor({ startedAt }: { startedAt: string }) {
  const seconds = useStopwatch(startedAt);
  return <>{formatDuration(Math.max(1, Math.floor(seconds / 60)))}</>;
}

/**
 * Stopping a running lesson, from the bar or from Next up: the notes (optional), then the record. A refusal -- a
 * price or a rate missing -- is said in place, every line of it, and "Keep going" keeps what was typed on the
 * running lesson (the stop saves it too, before pricing). Recorded, it offers the write-up (Phase 75, JF18, JF30).
 * Held by a parent that outlives the live lesson: `active` is the lesson being stopped, null when closed.
 */
export function StopLessonFlow({ active, onClose }: { active: ActiveSession | null; onClose: () => void }) {
  const [recorded, setRecorded] = useState<TutoringSession | null>(null);
  const [writingUp, setWritingUp] = useState(false);

  // A new stop starts clean.
  useEffect(() => {
    if (active) {
      setRecorded(null);
      setWritingUp(false);
    }
  }, [active]);

  const close = () => {
    setRecorded(null);
    setWritingUp(false);
    onClose();
  };

  return (
    <>
      {active && !writingUp && (
        <StopDialog
          active={active}
          recorded={recorded}
          onRecorded={setRecorded}
          onWriteUp={() => setWritingUp(true)}
          onClose={close}
        />
      )}
      {writingUp && recorded && (
        <SessionFormDialog open onOpenChange={(open) => !open && close()} existing={recorded} showMoney={false} />
      )}
    </>
  );
}

/**
 * "The tutor can record session details at that time or can edit those later."
 * Notes are offered here but never required.
 */
function StopDialog({
  active,
  recorded,
  onRecorded,
  onWriteUp,
  onClose,
}: {
  active: ActiveSession;
  recorded: TutoringSession | null;
  onRecorded: (session: TutoringSession) => void;
  onWriteUp: () => void;
  onClose: () => void;
}) {
  // Read once, when the dialog opens: the running lesson's own note, kept by an earlier Keep going or refused stop.
  const [notes, setNotes] = useState(active.notes ?? '');
  const [problems, setProblems] = useState<string[]>([]);
  const stop = useStopSession();
  const keep = useUpdateActiveSession();
  const busy = stop.isPending || keep.isPending;

  async function handleStop() {
    setProblems([]);
    try {
      const result = await stop.mutateAsync({ notes: notes.trim() || null } as never);
      onRecorded(result.data);
    } catch (error) {
      setProblems(error instanceof ApiRequestError ? refusalLines(error) : ['Could not stop the lesson.']);
    }
  }

  /** Back to the lesson, with the note kept on it -- so it is there on the next Stop, on any device. */
  async function keepGoing() {
    const typed = notes.trim() || null;
    if (typed !== (active.notes ?? null) || problems.length > 0) {
      try {
        await keep.mutateAsync({ notes: typed } as never);
      } catch (error) {
        setProblems(error instanceof ApiRequestError ? refusalLines(error) : ['Could not keep the note.']);
        return;
      }
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && (recorded ? onClose() : void keepGoing())}>
      <DialogContent className="sm:max-w-lg" data-testid={recorded ? 'stop-recorded' : 'stop-lesson'}>
        {recorded ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2Icon className="text-success size-5" aria-hidden /> Lesson recorded.
              </DialogTitle>
              {/* Said with the student beside the tutor, so the length and never the money (Phase 19). */}
              <DialogDescription>
                {recorded.student_name}, {formatClockTime(recorded.started_at)}–{formatClockTime(recorded.ended_at)},{' '}
                {formatDuration(recorded.duration_minutes)}. Add the write-up now, or later from the lesson.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} data-testid="stop-done">
                Done
              </Button>
              <Button onClick={onWriteUp} data-testid="stop-write-up">
                <PencilLineIcon /> Write up the lesson
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>End the lesson with {active.student_name}?</DialogTitle>
              <DialogDescription>
                The start is recorded to the nearest quarter hour, so this will be logged from{' '}
                {formatClockTime(active.rounded_start)}, and billed for however long it ran, rounded
                the same way — up to the {formatDuration(active.max_minutes)} limit for this pairing.
                You can edit the details afterwards.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-2">
              <Label htmlFor="live-notes">Session notes</Label>
              <textarea
                id="live-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="What was covered, how it went, progress towards their goal, homework set…"
                className="border-input bg-transparent placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
              <p className="text-muted-foreground text-xs">
                Optional. The rest of the write-up — the plan, the homework and your assessment — can
                be added by editing the lesson afterwards.
              </p>
            </div>

            {problems.length > 0 && <ProblemLines lines={problems} testId="stop-problem" />}

            <DialogFooter>
              <Button variant="outline" onClick={() => void keepGoing()} disabled={busy} data-testid="stop-keep-going">
                {keep.isPending && <Loader2Icon className="animate-spin" />}
                Keep going
              </Button>
              <Button onClick={handleStop} disabled={busy} data-testid="stop-submit">
                {stop.isPending && <Loader2Icon className="animate-spin" />}
                End and record
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const cancel = useCancelActiveSession();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this lesson?</AlertDialogTitle>
          <AlertDialogDescription>
            The timer stops and nothing is recorded or billed. Use this if it was started by
            mistake.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep going</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={cancel.isPending}
            onClick={async () => {
              await cancel.mutateAsync();
              toast.success('Lesson discarded.');
            }}
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
