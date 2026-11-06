import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  centsToInput,
  formatCents,
  parseCentsInput,
  LOCATION_KIND_LABELS,
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
import { useLocations, useSetPairingLocations } from '@/features/locations/api';

/**
 * "Admin, when assigning a student to the tutor can specify the hourly rate."
 *
 * A filled field is an OVERRIDE stored on the pairing, so it is captured as
 * typed and a later change to the tutor's default will not move it; an empty
 * field follows the tutor's default. Phase 75 (JF27): the form never copies the
 * default into the override -- that froze every new pairing at the rate of the
 * day -- and says the default in the placeholder instead ("Alex's default,
 * $75.00").
 */
export function AssignmentDialog({
  open,
  onOpenChange,
  existing,
  preset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: Assignment | null;
  /** A new pairing's tutor or student, chosen already (the onboarding wizard). */
  preset?: { tutor_user_id?: string; student_user_id?: string };
  /** Called once it has saved, with the pairing (Phase 76: the next step after an add sets its weekly lesson). */
  onSaved?: (assignment: Assignment) => void;
}) {
  const isEdit = existing !== null;

  const [tutorId, setTutorId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [inPerson, setInPerson] = useState('');
  const [virtual, setVirtual] = useState('');
  const [notes, setNotes] = useState('');
  // Phase 33: where this pair may have lessons, from the tutor's and the student's own places.
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' });
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name' });

  const create = useCreateAssignment();
  const update = useUpdateAssignment();
  const setLocations = useSetPairingLocations();
  const saving = create.isPending || update.isPending || setLocations.isPending;
  const tutorLocationsQuery = useLocations(tutorId || null);
  const studentLocationsQuery = useLocations(studentId || null);
  const tutorLocations = tutorLocationsQuery.data?.data ?? [];
  const studentLocations = studentLocationsQuery.data?.data ?? [];
  // Saving before both lists arrive would send an empty set and wipe the pairing's locations.
  const locationsLoading = Boolean(
    (tutorId && tutorLocationsQuery.isPending) || (studentId && studentLocationsQuery.isPending),
  );
  const offered = [...tutorLocations, ...studentLocations];

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setTutorId(existing?.tutor_user_id ?? preset?.tutor_user_id ?? '');
    setStudentId(existing?.student_user_id ?? preset?.student_user_id ?? '');
    setInPerson(centsToInput(existing?.rate_in_person_cents));
    setVirtual(centsToInput(existing?.rate_virtual_cents));
    setNotes(existing?.notes ?? '');
    setLocationIds(existing?.locations.map((location) => location.id) ?? []);
    // The preset's ids, not the object: a new object each render would reset
    // the form under the admin's typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing, preset?.tutor_user_id, preset?.student_user_id]);

  const selectedTutor = tutors.data?.data.find((candidate) => candidate.id === tutorId);

  // The list rows carry no rates, so the chosen tutor's profile is fetched for
  // their defaults: said in the placeholders, never copied into the fields.
  const tutorDetail = useUserDetail(tutorId || null);
  const tutorDefaults = tutorDetail.data?.data.tutor_profile ?? null;
  const tutorName = existing?.tutor_name ?? selectedTutor?.full_name ?? null;
  const tutorFirst = tutorName ? (tutorName.split(/\s+/)[0] ?? tutorName) : null;

  /** What an empty field follows, named: "Alex's default, $75.00". */
  const placeholderFor = (defaultCents: number | null | undefined) =>
    !tutorFirst ? '' : defaultCents != null ? `${tutorFirst}'s default, ${formatCents(defaultCents)}` : `${tutorFirst} has no default`;

  /** Below a field: what empty means, or that it is the same as the default, or that nothing would price it. */
  const hintFor = (typed: string, defaultCents: number | null | undefined) => {
    if (!tutorFirst) return 'Empty follows the tutor’s default.';
    const cents = parseCentsInput(typed);
    if (cents != null) return cents === defaultCents ? `The same as ${tutorFirst}'s default.` : 'Set for this pairing only.';
    return defaultCents != null
      ? `Empty follows ${tutorFirst}'s default.`
      : `${tutorFirst} has no default rate: set one here, or lessons cannot be priced.`;
  };

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
      // Only places still offered: one of a person no longer chosen falls away.
      const chosenLocations = locationIds.filter((id) => offered.some((location) => location.id === id));
      if (isEdit) {
        const saved = await update.mutateAsync({ id: existing.id, input: rates as never });
        const before = existing.locations.map((location) => location.id).sort().join();
        if (before !== [...chosenLocations].sort().join()) {
          await setLocations.mutateAsync({ assignmentId: existing.id, locationIds: chosenLocations });
        }
        toast.success('Pairing updated.');
        onSaved?.(saved.data);
      } else {
        const created = await create.mutateAsync({
          tutor_user_id: tutorId,
          student_user_id: studentId,
          is_active: true,
          ...rates,
        } as never);
        if (chosenLocations.length > 0) {
          await setLocations.mutateAsync({ assignmentId: created.data.id, locationIds: chosenLocations });
        }
        toast.success('Student assigned.');
        onSaved?.(created.data);
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the pairing.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit pairing' : 'Pair a tutor with a student'}</DialogTitle>
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
                label="Tutor pay, in person"
                error={errors.rate_in_person_cents}
                hint={hintFor(inPerson, tutorDefaults?.default_rate_in_person_cents)}
                optional
              >
                <Input
                  id="rate_ip"
                  inputMode="decimal"
                  value={inPerson}
                  onChange={(event) => setInPerson(event.target.value)}
                  placeholder={placeholderFor(tutorDefaults?.default_rate_in_person_cents)}
                />
              </Field>

              <Field
                id="rate_v"
                label="Tutor pay, virtual"
                error={errors.rate_virtual_cents}
                hint={hintFor(virtual, tutorDefaults?.default_rate_virtual_cents)}
                optional
              >
                <Input
                  id="rate_v"
                  inputMode="decimal"
                  value={virtual}
                  onChange={(event) => setVirtual(event.target.value)}
                  placeholder={placeholderFor(tutorDefaults?.default_rate_virtual_cents)}
                />
              </Field>
            </div>

            <fieldset className="grid gap-2" data-testid="pairing-locations">
              <legend className={`mb-1 text-sm font-medium ${errors.location_ids ? 'text-destructive' : ''}`}>
                Locations <span className="text-muted-foreground font-normal">(where this pair may meet)</span>
              </legend>
              {!tutorId || !studentId ? (
                <p className="text-muted-foreground text-xs">Choose the tutor and the student first.</p>
              ) : offered.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Neither has a location yet. Add them on each person&apos;s record.
                </p>
              ) : (
                offered.map((location) => (
                  <label key={location.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      checked={locationIds.includes(location.id)}
                      onChange={(event) =>
                        setLocationIds((current) =>
                          event.target.checked
                            ? [...current, location.id]
                            : current.filter((id) => id !== location.id),
                        )
                      }
                    />
                    <span>{location.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {LOCATION_KIND_LABELS[location.kind]} · {location.owner_name}
                    </span>
                  </label>
                ))
              )}
              {errors.location_ids && (
                <p role="alert" className="text-destructive text-xs">
                  {errors.location_ids}
                </p>
              )}
            </fieldset>

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
            <Button type="submit" disabled={saving || locationsLoading}>
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
