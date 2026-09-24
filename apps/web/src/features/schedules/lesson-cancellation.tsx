import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DAYS_OF_WEEK,
  SCHEDULE_CANCELLER_LABELS,
  describeSchedule,
  zonedClockParts,
  type ScheduleCancellerRole,
  type VisibleSchedule,
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
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NoteField } from '@/features/teaching/session-notes';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useCancelLesson, useRestoreLesson } from './api';

// ---------------------------------------------------------------------------
// Phase 24: calling off one lesson of a standing schedule, and putting it
// back. Nothing here is money; all of it is shown on the Tutoring side.
// ---------------------------------------------------------------------------

/** Today on the institute's clock -- the one the API checks "past" against. */
export function instituteToday(): string {
  return zonedClockParts(new Date().toISOString()).day;
}

/** A calendar date moved by whole days, as YYYY-MM-DD. */
export function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, (day ?? 1) + days)).toISOString().slice(0, 10);
}

/** "Tue, Sep 29", read as a calendar date wherever the reader is. */
export function formatLessonDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "by Maria Okafor (the family)", or just the capacity once they are gone. */
export function cancelledByText(name: string | null, role: ScheduleCancellerRole): string {
  return name ? `by ${name} (${SCHEDULE_CANCELLER_LABELS[role]})` : `by ${SCHEDULE_CANCELLER_LABELS[role]}`;
}

/**
 * Calls off one lesson of a series, with an optional note. Opened with a date
 * from the list of coming dates, or without one to pick any date -- a later
 * week, or (for the tutor and the office) one already past.
 */
export function CancelLessonDialog({
  target,
  onClose,
}: {
  /** The series and, when chosen already, the date. Null closes it. */
  target: { schedule: VisibleSchedule; date: string | null } | null;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const cancel = useCancelLesson();

  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!target) return;
    setDate(target.date ?? '');
    setNote('');
    setErrors({});
  }, [target]);

  const schedule = target?.schedule;
  const today = instituteToday();
  // A parent may only call off today or later; the tutor and the office may
  // also mark a past lesson. The API holds the same line.
  const futureOnly = schedule?.cancel_as === 'parent' && !isAdmin;
  const min = schedule
    ? futureOnly && today > schedule.starts_on
      ? today
      : schedule.starts_on
    : undefined;
  const dayLabel = schedule ? (DAYS_OF_WEEK[schedule.day_of_week]?.label ?? '') : '';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!schedule) return;
    setErrors({});

    if (!date) {
      setErrors({ occurs_on: 'Choose the date of the lesson to cancel.' });
      return;
    }

    try {
      await cancel.mutateAsync({
        scheduleId: schedule.id,
        input: { occurs_on: date, note: note.trim() || null },
      });
      toast.success(`The ${formatLessonDay(date)} lesson is cancelled.`);
      onClose();
    } catch (error) {
      if (error instanceof ApiRequestError) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not cancel the lesson.');
    }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {target?.date ? `Cancel the lesson on ${formatLessonDay(target.date)}?` : 'Cancel a lesson'}
            </DialogTitle>
            <DialogDescription>
              {schedule && (
                <>
                  {schedule.student_name} with {schedule.tutor_name}, {describeSchedule(schedule)}. Only
                  this date is called off; the rest of the series is unchanged.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!target?.date && (
              <div className="grid gap-1.5">
                <Label htmlFor="cancel-date" className={errors.occurs_on ? 'text-destructive' : ''}>
                  Date
                </Label>
                <Input
                  id="cancel-date"
                  type="date"
                  value={date}
                  min={min}
                  max={schedule?.ends_on ?? undefined}
                  onChange={(event) => setDate(event.target.value)}
                  aria-invalid={Boolean(errors.occurs_on)}
                />
                <p className="text-muted-foreground text-xs">
                  {dayLabel}s only{futureOnly ? ', from today on' : ''}.
                </p>
              </div>
            )}
            {errors.occurs_on && (
              <p role="alert" className="text-destructive -mt-2 text-xs">
                {errors.occurs_on}
              </p>
            )}

            <NoteField
              id="cancel-note"
              label="Note"
              value={note}
              onChange={setNote}
              placeholder="Why, for the record: a holiday, a trip, illness…"
              hint="Optional. Seen by the tutor, the family and the office."
              error={errors.note}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={cancel.isPending}>
              Keep the lesson
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending}>
              {cancel.isPending && <Loader2Icon className="animate-spin" />}
              Cancel lesson
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Puts a cancelled lesson back in its series. */
export function RestoreLessonDialog({
  target,
  onClose,
}: {
  target: { scheduleId: string; occursOn: string; studentName: string } | null;
  onClose: () => void;
}) {
  const restore = useRestoreLesson();

  async function handleRestore() {
    if (!target) return;

    try {
      await restore.mutateAsync({ scheduleId: target.scheduleId, occursOn: target.occursOn });
      toast.success(`The ${formatLessonDay(target.occursOn)} lesson is back on.`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not restore the lesson.',
      );
    }
  }

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Restore the lesson on {target && formatLessonDay(target.occursOn)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target?.studentName}&apos;s lesson that day goes back into the schedule, the dashboard
            and the calendar file, and counts as planned again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Leave it cancelled</AlertDialogCancel>
          <AlertDialogAction onClick={handleRestore} disabled={restore.isPending}>
            Restore lesson
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
