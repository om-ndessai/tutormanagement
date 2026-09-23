import { useEffect, useState } from 'react';
import { Loader2Icon, SquareIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  SESSION_MODE_LABELS,
  elapsedSince,
  formatDuration,
  formatClockTime,
  formatStopwatch,
  type ActiveSession,
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
} from './api';

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

  const [stopping, setStopping] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!active) return null;

  return (
    <>
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
            <Button size="sm" onClick={() => setStopping(true)}>
              <SquareIcon className="fill-current" />
              Stop
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Discard this session"
              onClick={() => setCancelling(true)}
            >
              <XIcon />
            </Button>
          </div>
        </div>
      </div>

      <StopDialog active={active} open={stopping} onOpenChange={setStopping} />
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

/**
 * "The tutor can record session details at that time or can edit those later."
 * Notes are offered here but never required.
 */
function StopDialog({
  active,
  open,
  onOpenChange,
}: {
  active: ActiveSession;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [notes, setNotes] = useState('');
  const stop = useStopSession();

  useEffect(() => {
    if (open) setNotes(active.notes ?? '');
  }, [open, active.notes]);

  async function handleStop() {
    try {
      const result = await stop.mutateAsync({ notes: notes.trim() || null } as never);
      const session = result.data;

      // Said with the student beside the tutor, so the length and never the
      // money (Phase 19): the amount is on the sessions page's Finance tab.
      toast.success(
        `Session recorded: ${formatClockTime(session.started_at)}–` +
          `${formatClockTime(session.ended_at)}, ${formatDuration(session.duration_minutes)}.`,
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not stop the session.',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>End the session with {active.student_name}?</DialogTitle>
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
          <p className="text-muted-foreground text-xs">Optional — you can add these later.</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={stop.isPending}>
            Keep going
          </Button>
          <Button onClick={handleStop} disabled={stop.isPending}>
            {stop.isPending && <Loader2Icon className="animate-spin" />}
            End and record
          </Button>
        </DialogFooter>
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
          <AlertDialogTitle>Discard this session?</AlertDialogTitle>
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
              toast.success('Session discarded.');
            }}
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
