import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DAYS_OF_WEEK,
  SESSION_MODES,
  SESSION_MODE_LABELS,
  formatDuration,
  type ScheduledSession,
  type SessionMode,
} from '@tmi/shared';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssignments } from '@/features/teaching/api';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useCreateSchedule, useUpdateSchedule } from './api';

/** Lesson lengths worth offering; anything else is an edge case. */
const DURATIONS = [30, 45, 60, 75, 90, 120];

function todayIso() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: ScheduledSession | null;
}) {
  const isEdit = existing !== null;
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [assignmentId, setAssignmentId] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState('2');
  const [startTime, setStartTime] = useState('16:00');
  const [duration, setDuration] = useState('60');
  const [mode, setMode] = useState<SessionMode>('in_person');
  const [startsOn, setStartsOn] = useState(todayIso);
  const [endsOn, setEndsOn] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // An admin may schedule for anyone; a tutor only for their own students.
  const { data: assignmentsData } = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const assignments = assignmentsData?.data ?? [];

  const create = useCreateSchedule();
  const update = useUpdateSchedule();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setErrors({});

    if (existing) {
      setDayOfWeek(String(existing.day_of_week));
      setStartTime(existing.start_time);
      setDuration(String(existing.duration_minutes));
      setMode(existing.mode);
      setStartsOn(existing.starts_on);
      setEndsOn(existing.ends_on ?? '');
      setLocation(existing.location ?? '');
      setNotes(existing.notes ?? '');
    } else {
      setAssignmentId(assignments.length === 1 ? assignments[0]!.id : '');
      setDayOfWeek('2');
      setStartTime('16:00');
      setDuration('60');
      setMode('in_person');
      setStartsOn(todayIso());
      setEndsOn('');
      setLocation('');
      setNotes('');
    }
    // `assignments` excluded on purpose: a refetch mid-edit would reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    const assignment = assignments.find((candidate) => candidate.id === assignmentId);

    if (!isEdit && !assignment) {
      setErrors({ assignment: 'Choose which student this is for.' });
      return;
    }

    const shared = {
      day_of_week: Number(dayOfWeek),
      start_time: startTime,
      duration_minutes: Number(duration),
      mode,
      starts_on: startsOn,
      ends_on: endsOn || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id: existing.id, input: shared as never });
        toast.success('Schedule updated.');
      } else {
        await create.mutateAsync({
          tutor_user_id: assignment!.tutor_user_id,
          student_user_id: assignment!.student_user_id,
          ...shared,
        } as never);
        toast.success('Session scheduled.');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the schedule.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit schedule' : 'Schedule a session'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `${existing.tutor_name} with ${existing.student_name}, every week.`
                : 'A standing weekly lesson. Everyone involved can add it to their calendar.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!isEdit && (
              <Field id="who" label="Student" error={errors.assignment ?? errors.student_user_id}>
                <Select value={assignmentId} onValueChange={setAssignmentId}>
                  <SelectTrigger id="who" className="w-full">
                    <SelectValue placeholder="Choose a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.student_name}
                        {isAdmin && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            with {assignment.tutor_name}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignments.length === 0 && (
                  <p className="text-muted-foreground text-xs">
                    No students assigned yet. An admin assigns students to tutors.
                  </p>
                )}
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="dow" label="Every">
                <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                  <SelectTrigger id="dow" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="at" label="At" error={errors.start_time}>
                <Input
                  id="at"
                  type="time"
                  step={900}
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                />
              </Field>

              <Field id="len" label="For" error={errors.duration_minutes}>
                <Select value={duration} onValueChange={setDuration}>
                  <SelectTrigger id="len" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((minutes) => (
                      <SelectItem key={minutes} value={String(minutes)}>
                        {formatDuration(minutes)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="from" label="Starting" error={errors.starts_on}>
                <Input
                  id="from"
                  type="date"
                  value={startsOn}
                  onChange={(event) => setStartsOn(event.target.value)}
                />
              </Field>

              <Field
                id="until"
                label="Until"
                optional
                error={errors.ends_on}
                hint="Blank runs indefinitely."
              >
                <Input
                  id="until"
                  type="date"
                  value={endsOn}
                  min={startsOn}
                  onChange={(event) => setEndsOn(event.target.value)}
                />
              </Field>

              <Field id="how" label="Mode">
                <Select value={mode} onValueChange={(value) => setMode(value as SessionMode)}>
                  <SelectTrigger id="how" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_MODES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {SESSION_MODE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field
              id="where"
              label={mode === 'virtual' ? 'Meeting link' : 'Location'}
              optional
              error={errors.location}
            >
              <Input
                id="where"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={
                  mode === 'virtual' ? 'https://meet.example.com/…' : 'Institute, room 2'
                }
              />
            </Field>

            <Field id="snotes" label="Notes" optional error={errors.notes}>
              <Input
                id="snotes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Exam prep, weekly slot…"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Schedule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    // content-start, not the default stretch: a grid row sizes every field in
    // it to the tallest, and a field carrying a hint or an error is taller. Let
    // the rows stretch and the inputs beside it drift down out of line with it.
    <div className="grid content-start gap-2">
      <Label htmlFor={id} className={error ? 'text-destructive' : undefined}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">(optional)</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
