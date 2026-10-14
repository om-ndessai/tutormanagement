import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DAYS_OF_WEEK,
  SESSION_MODES,
  SESSION_MODE_LABELS,
  LOCATION_KIND_LABELS,
  formatDuration,
  scheduleLocationProblem,
  type Location,
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
  // Phase 33: one in-person place and one online room, each optional, at least one in all.
  const [physicalId, setPhysicalId] = useState('');
  const [virtualId, setVirtualId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // An admin may schedule for anyone; a tutor only for their own students.
  const { data: assignmentsData } = useAssignments(isAdmin ? {} : { tutor_user_id: user?.id });
  const assignments = assignmentsData?.data ?? [];

  // The pairing whose locations this schedule may use: the chosen one, or the one being edited.
  const pairing = existing
    ? assignments.find(
        (candidate) =>
          candidate.tutor_user_id === existing.tutor_user_id && candidate.student_user_id === existing.student_user_id,
      )
    : assignments.find((candidate) => candidate.id === assignmentId);
  const pairingLocations: Location[] = pairing?.locations ?? existing?.locations ?? [];
  const physical = pairingLocations.filter((location) => location.kind === 'physical');
  const virtual = pairingLocations.filter((location) => location.kind === 'virtual');

  // A new schedule starts at the tutor's own in-person place (else the first offered), so the
  // common case needs no choice at all.
  useEffect(() => {
    if (!open || existing || !pairing) return;
    const first =
      pairing.locations.find((l) => l.kind === 'physical' && l.owner_user_id === pairing.tutor_user_id) ??
      pairing.locations.find((l) => l.kind === 'physical') ??
      null;
    setPhysicalId(first?.id ?? '');
    setVirtualId(first ? '' : (pairing.locations.find((l) => l.kind === 'virtual')?.id ?? ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing, pairing?.id]);

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
      setPhysicalId(existing.locations.find((l) => l.kind === 'physical')?.id ?? '');
      setVirtualId(existing.locations.find((l) => l.kind === 'virtual')?.id ?? '');
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

    const chosen = pairingLocations.filter((l) => l.id === physicalId || l.id === virtualId);
    const problem = scheduleLocationProblem(chosen);
    if (problem) {
      setErrors({ location_ids: problem });
      return;
    }

    const shared = {
      location_ids: chosen.map((l) => l.id),
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

            <div className="grid gap-4 sm:grid-cols-2">
              <LocationSelect
                id="loc-physical"
                label={LOCATION_KIND_LABELS.physical}
                options={physical}
                value={physicalId}
                onChange={setPhysicalId}
              />
              <LocationSelect
                id="loc-virtual"
                label={LOCATION_KIND_LABELS.virtual}
                options={virtual}
                value={virtualId}
                onChange={setVirtualId}
              />
            </div>
            {errors.location_ids ? (
              <p role="alert" className="text-destructive -mt-2 text-xs">
                {errors.location_ids}
              </p>
            ) : pairing && pairingLocations.length === 0 ? (
              <p className="text-muted-foreground -mt-2 text-xs">
                This pairing has no locations yet. An admin adds them on the Pairings page.
              </p>
            ) : (
              <p className="text-muted-foreground -mt-2 text-xs">
                At least one, and at most one of each.
              </p>
            )}

            <Field
              id="where"
              label={mode === 'virtual' ? 'Meeting link note' : 'Room or note'}
              optional
              error={errors.location}
            >
              <Input
                id="where"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder={
                  mode === 'virtual' ? 'https://meet.example.com/…' : 'Room 2'
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

const NONE = '__none__';

/** One kind of place for a schedule: none, or one of the pairing's. */
function LocationSelect({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Location[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <Select value={value || NONE} onValueChange={(next) => onChange(next === NONE ? '' : next)}>
        <SelectTrigger id={id} className="w-full" data-testid={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>None</SelectItem>
          {options.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
              <span className="text-muted-foreground ml-2 text-xs">{location.owner_name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
