import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  centsToInput,
  formatCents,
  parseCentsInput,
  type Assignment,
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
import { useUserDetail, useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { useCreateAssignment, useUpdateAssignment } from './api';

/**
 * "Admin, when assigning a student to the tutor can specify the hourly rate."
 *
 * Choosing a tutor fills both rate fields with that tutor's current defaults,
 * so the admin can see what this pairing will cost without leaving the dialog,
 * and adjust from a real number rather than from nothing.
 *
 * Note what this means: a filled field is an OVERRIDE stored on the assignment,
 * so the rate is captured as of the moment the pairing was made and a later
 * change to the tutor's default will not move it. Clearing a field restores the
 * inherit-from-tutor behaviour.
 */
export function AssignmentDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: Assignment | null;
}) {
  const isEdit = existing !== null;

  const [tutorId, setTutorId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [inPerson, setInPerson] = useState('');
  const [virtual, setVirtual] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Which tutor's defaults have already been written into the fields. Guards
  // the prefill so it happens once per choice and never overwrites typing.
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);

  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' });
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name' });

  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTutorId(existing?.tutor_user_id ?? '');
    setStudentId(existing?.student_user_id ?? '');
    setInPerson(centsToInput(existing?.rate_in_person_cents));
    setVirtual(centsToInput(existing?.rate_virtual_cents));
    setNotes(existing?.notes ?? '');
    // An existing assignment already carries its own rates; only a new pairing
    // takes them from the tutor.
    setPrefilledFor(existing ? existing.tutor_user_id : null);
  }, [open, existing]);

  const selectedTutor = tutors.data?.data.find((candidate) => candidate.id === tutorId);

  // The list rows carry no rates, so the chosen tutor's profile is fetched for
  // them. Skipped while editing, where the assignment's own rates win.
  const tutorDetail = useUserDetail(!isEdit && tutorId ? tutorId : null);
  const tutorDefaults = tutorDetail.data?.data.tutor_profile ?? null;

  useEffect(() => {
    if (isEdit || !tutorId || !tutorDefaults || prefilledFor === tutorId) return;

    setInPerson(centsToInput(tutorDefaults.default_rate_in_person_cents));
    setVirtual(centsToInput(tutorDefaults.default_rate_virtual_cents));
    setPrefilledFor(tutorId);
  }, [isEdit, tutorId, tutorDefaults, prefilledFor]);

  // Both fields say the same thing, so the wording stays short enough to read
  // twice. Once a tutor is chosen the fields hold real numbers, and the useful
  // fact becomes what clearing one does -- or, if the tutor has no rate at all,
  // that this pairing cannot record a session until one is set somewhere.
  const hasAnyDefault =
    tutorDefaults != null &&
    (tutorDefaults.default_rate_in_person_cents != null ||
      tutorDefaults.default_rate_virtual_cents != null);

  const rateHint =
    isEdit || !selectedTutor
      ? "Blank uses the tutor's default."
      : hasAnyDefault
        ? `From ${selectedTutor.full_name}'s profile. Clear to follow their default instead.`
        : `${selectedTutor.full_name} has no default rate — set one here, or sessions cannot be priced.`;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});

    if (!isEdit && (!tutorId || !studentId)) {
      setErrors({
        ...(tutorId ? {} : { tutor_user_id: 'Choose a tutor.' }),
        ...(studentId ? {} : { student_user_id: 'Choose a student.' }),
      });
      return;
    }

    const rates = {
      rate_in_person_cents: parseCentsInput(inPerson),
      rate_virtual_cents: parseCentsInput(virtual),
      notes: notes.trim() || null,
    };

    try {
      if (isEdit) {
        await update.mutateAsync({ id: existing.id, input: rates as never });
        toast.success('Assignment updated.');
      } else {
        await create.mutateAsync({
          tutor_user_id: tutorId,
          student_user_id: studentId,
          is_active: true,
          ...rates,
        } as never);
        toast.success('Student assigned.');
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the assignment.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit assignment' : 'Assign a student'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? `${existing.tutor_name} teaches ${existing.student_name}.`
                : 'Pair a tutor with a student. Only assigned pairs can record sessions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {!isEdit && (
              <>
                <Field id="tutor" label="Tutor" error={errors.tutor_user_id}>
                  <Select value={tutorId} onValueChange={setTutorId}>
                    <SelectTrigger id="tutor" className="w-full">
                      <SelectValue placeholder="Choose a tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tutors.data?.data ?? []).map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field id="student" label="Student" error={errors.student_user_id}>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger id="student" className="w-full">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {(students.data?.data ?? [])
                        .filter((candidate) => candidate.id !== tutorId)
                        .map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="rate_ip"
                label="In-person rate"
                error={errors.rate_in_person_cents}
                hint={rateHint}
              >
                <Input
                  id="rate_ip"
                  inputMode="decimal"
                  value={inPerson}
                  onChange={(event) => setInPerson(event.target.value)}
                  placeholder={fallbackHint(
                    existing
                      ? existing.effective_rate_in_person_cents
                      : (tutorDefaults?.default_rate_in_person_cents ?? null),
                    '75.00',
                  )}
                />
              </Field>

              <Field
                id="rate_v"
                label="Virtual rate"
                error={errors.rate_virtual_cents}
                hint={rateHint}
              >
                <Input
                  id="rate_v"
                  inputMode="decimal"
                  value={virtual}
                  onChange={(event) => setVirtual(event.target.value)}
                  placeholder={fallbackHint(
                    existing
                      ? existing.effective_rate_virtual_cents
                      : (tutorDefaults?.default_rate_virtual_cents ?? null),
                    '65.00',
                  )}
                />
              </Field>
            </div>

            <Field id="notes" label="Notes" error={errors.notes} optional>
              <Input
                id="notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Weekly, building towards the accelerated track"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** What a cleared field will fall back to, named rather than implied. */
function fallbackHint(fallbackCents: number | null, example: string): string {
  if (fallbackCents == null) return example;
  return `${formatCents(fallbackCents)} (default)`;
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
    <div className="grid gap-2">
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
