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
import { useUsers } from '@/features/users/api';
import { ApiRequestError } from '@/lib/api-client';
import { useCreateAssignment, useUpdateAssignment } from './api';

/**
 * "Admin, when assigning a student to the tutor can specify the hourly rate."
 *
 * Both rate fields are optional. Left blank, the tutor's own default applies,
 * so the common case needs no thought and the exception is one number.
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
  }, [open, existing]);

  const selectedTutor = tutors.data?.data.find((candidate) => candidate.id === tutorId);

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
                hint="Blank uses the tutor's default."
              >
                <Input
                  id="rate_ip"
                  inputMode="decimal"
                  value={inPerson}
                  onChange={(event) => setInPerson(event.target.value)}
                  placeholder={
                    existing
                      ? formatCents(existing.effective_rate_in_person_cents)
                      : selectedTutor
                        ? 'default'
                        : '75.00'
                  }
                />
              </Field>

              <Field
                id="rate_v"
                label="Virtual rate"
                error={errors.rate_virtual_cents}
                hint="Blank uses the tutor's default."
              >
                <Input
                  id="rate_v"
                  inputMode="decimal"
                  value={virtual}
                  onChange={(event) => setVirtual(event.target.value)}
                  placeholder={
                    existing ? formatCents(existing.effective_rate_virtual_cents) : '65.00'
                  }
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
