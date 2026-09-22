import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_MAX_SESSION_MINUTES,
  SESSION_LIMIT_CHOICES,
  USER_STATUSES,
  USER_STATUS_LABELS,
  centsToInput,
  formatDuration,
  parseCentsInput,
  createUserRequestSchema,
  updateUserRequestSchema,
  type AvailabilitySlot,
  type PaymentHandle,
  type UserDetail,
  type UserRole,
  type UserStatus,
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
import { Separator } from '@/components/ui/separator';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCreateUser, useUpdateUser, useUserDetail } from './api';
import { AvailabilityPicker } from './availability-picker';
import { GuardianPicker } from './guardian-picker';
import { PaymentHandlesField } from './payment-handles-field';
import { RoleSelector } from './role-selector';

interface GuardianValue {
  guardian_user_id: string;
  relationship: 'mother' | 'father' | 'guardian' | 'other';
  is_primary: boolean;
}

interface FormState {
  email: string;
  full_name: string;
  phone: string;
  status: UserStatus;
  roles: UserRole[];
  tutor: {
    highest_education: string;
    school: string;
    area: string;
    availability_notes: string;
    virtual_available: boolean;
    /** Dollars as typed; converted to cents on submit. */
    rate_in_person: string;
    rate_virtual: string;
    /** Minutes, or "" for "no limit of their own". */
    max_minutes: string;
    /** Dollars as typed; "" means this tutor is not paid in advance. */
    topup: string;
  };
  student: {
    school: string;
    current_math_course: string;
    academic_year_goal: string;
    virtual_available: boolean;
    /** Dollars as typed; converted to cents on submit. */
    charge_in_person: string;
    charge_virtual: string;
    /** Minutes, or "" for "no limit of their own". */
    max_minutes: string;
  };
  payment_handles: PaymentHandle[];
  availability: AvailabilitySlot[];
  guardians: GuardianValue[];
}

const EMPTY: FormState = {
  email: '',
  full_name: '',
  phone: '',
  status: 'active',
  roles: [],
  tutor: {
    highest_education: '',
    school: '',
    area: '',
    availability_notes: '',
    virtual_available: false,
    rate_in_person: '',
    rate_virtual: '',
    max_minutes: '',
    topup: '',
  },
  student: {
    school: '',
    current_math_course: '',
    academic_year_goal: '',
    virtual_available: false,
    charge_in_person: '',
    charge_virtual: '',
    max_minutes: '',
  },
  payment_handles: [],
  availability: [],
  guardians: [],
};

function fromDetail(detail: UserDetail): FormState {
  return {
    email: detail.email,
    full_name: detail.full_name,
    phone: detail.phone ?? '',
    status: detail.status,
    roles: detail.roles,
    tutor: {
      highest_education: detail.tutor_profile?.highest_education ?? '',
      school: detail.tutor_profile?.school ?? '',
      area: detail.tutor_profile?.area ?? '',
      availability_notes: detail.tutor_profile?.availability_notes ?? '',
      virtual_available: detail.tutor_profile?.virtual_available ?? false,
      rate_in_person: centsToInput(detail.tutor_profile?.default_rate_in_person_cents),
      rate_virtual: centsToInput(detail.tutor_profile?.default_rate_virtual_cents),
      max_minutes: detail.tutor_profile?.max_session_minutes?.toString() ?? '',
      topup: centsToInput(detail.tutor_profile?.topup_amount_cents),
    },
    student: {
      school: detail.student_profile?.school ?? '',
      current_math_course: detail.student_profile?.current_math_course ?? '',
      academic_year_goal: detail.student_profile?.academic_year_goal ?? '',
      virtual_available: detail.student_profile?.virtual_available ?? false,
      charge_in_person: centsToInput(detail.student_profile?.charge_rate_in_person_cents),
      charge_virtual: centsToInput(detail.student_profile?.charge_rate_virtual_cents),
      max_minutes: detail.student_profile?.max_session_minutes?.toString() ?? '',
    },
    payment_handles: detail.payment_handles,
    availability: detail.availability,
    guardians: detail.guardians.map((link) => ({
      guardian_user_id: link.user_id,
      relationship: link.relationship,
      is_primary: link.is_primary,
    })),
  };
}

/**
 * Builds the request body. Role-specific sections are sent as null when the
 * role is not held, which is what tells the API to drop that profile row --
 * the schema's rule is that a profile exists only while its role does.
 */
function toRequest(form: FormState) {
  const isTutor = form.roles.includes('tutor');
  const isStudent = form.roles.includes('student');

  return {
    email: form.email,
    full_name: form.full_name,
    phone: form.phone,
    status: form.status,
    roles: form.roles,
    tutor_profile: isTutor
      ? {
          highest_education: form.tutor.highest_education,
          school: form.tutor.school,
          area: form.tutor.area,
          availability_notes: form.tutor.availability_notes,
          virtual_available: form.tutor.virtual_available,
          default_rate_in_person_cents: parseCentsInput(form.tutor.rate_in_person),
          default_rate_virtual_cents: parseCentsInput(form.tutor.rate_virtual),
          max_session_minutes: form.tutor.max_minutes ? Number(form.tutor.max_minutes) : null,
          topup_amount_cents: parseCentsInput(form.tutor.topup),
        }
      : null,
    student_profile: isStudent
      ? {
          school: form.student.school,
          current_math_course: form.student.current_math_course,
          academic_year_goal: form.student.academic_year_goal,
          virtual_available: form.student.virtual_available,
          charge_rate_in_person_cents: parseCentsInput(form.student.charge_in_person),
          charge_rate_virtual_cents: parseCentsInput(form.student.charge_virtual),
          max_session_minutes: form.student.max_minutes ? Number(form.student.max_minutes) : null,
        }
      : null,
    payment_handles: form.payment_handles,
    // Availability only means something for someone who teaches or learns.
    availability: isTutor || isStudent ? form.availability : [],
    guardians: form.guardians,
  };
}

/**
 * One dialog for both create and edit. Passing a `userId` switches it to edit
 * mode, where the full record is loaded before the form is populated.
 */
export function UserFormDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}) {
  const isEdit = userId !== null;
  const { data: detail, isPending: loadingDetail } = useUserDetail(open && isEdit ? userId : null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const saving = createUser.isPending || updateUser.isPending;

  // Repopulate whenever the dialog opens, or the loaded record arrives.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(isEdit ? (detail ? fromDetail(detail.data) : EMPTY) : EMPTY);
  }, [open, isEdit, detail]);

  const isTutor = form.roles.includes('tutor');
  const isStudent = form.roles.includes('student');
  const isParent = form.roles.includes('parent');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const { [key as string]: _removed, ...rest } = previous;
      return rest;
    });
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const request = toRequest(form);
    const schema = isEdit ? updateUserRequestSchema : createUserRequestSchema;
    const parsed = schema.safeParse(request);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join('.') || '_'] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      if (isEdit) {
        await updateUser.mutateAsync({ id: userId, input: parsed.data as never });
        toast.success(`${form.full_name} updated.`);
      } else {
        await createUser.mutateAsync(parsed.data as never);
        toast.success(`${form.full_name} added.`);
      }
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the user.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogDescription>
              One person, one record. Check every role they hold — the rest of the form follows.
            </DialogDescription>
          </DialogHeader>

          {isEdit && loadingDetail ? (
            <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Loading record…
            </p>
          ) : (
            <div className="grid gap-5 py-4">
              <Field id="full_name" label="Full name" error={errors.full_name}>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  aria-invalid={Boolean(errors.full_name)}
                  placeholder="Alex Chen"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="email" label="Email" error={errors.email}>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    placeholder="alex@gmail.com"
                  />
                </Field>

                <Field id="phone" label="Phone" error={errors.phone} optional>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    aria-invalid={Boolean(errors.phone)}
                    placeholder="(919) 555-0142"
                  />
                </Field>
              </div>

              <Field id="status" label="Status" error={errors.status}>
                <Select
                  value={form.status}
                  onValueChange={(v) => set('status', v as UserStatus)}
                >
                  <SelectTrigger id="status" className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {USER_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Separator />

              <RoleSelector
                value={form.roles}
                onChange={(roles) => set('roles', roles)}
                error={errors.roles}
              />

              {isTutor && (
                <>
                  <Separator />
                  <SectionHeading title="Tutor details" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="t_edu"
                      label="Highest education"
                      hint="Or their current grade / math course."
                    >
                      <Input
                        id="t_edu"
                        value={form.tutor.highest_education}
                        onChange={(e) =>
                          set('tutor', { ...form.tutor, highest_education: e.target.value })
                        }
                        placeholder="MS, Applied Mathematics"
                      />
                    </Field>
                    <Field id="t_school" label="School">
                      <Input
                        id="t_school"
                        value={form.tutor.school}
                        onChange={(e) => set('tutor', { ...form.tutor, school: e.target.value })}
                        placeholder="NC State"
                      />
                    </Field>
                    <Field id="t_area" label="Area" hint="No street address is recorded.">
                      <Input
                        id="t_area"
                        value={form.tutor.area}
                        onChange={(e) => set('tutor', { ...form.tutor, area: e.target.value })}
                        placeholder="Chapel Hill"
                      />
                    </Field>
                    <Field id="t_notes" label="Availability notes" optional>
                      <Input
                        id="t_notes"
                        value={form.tutor.availability_notes}
                        onChange={(e) =>
                          set('tutor', { ...form.tutor, availability_notes: e.target.value })
                        }
                        placeholder="Term-time only"
                      />
                    </Field>
                  </div>
                  <Checkbox
                    id="t_virtual"
                    label="Available for virtual tutoring"
                    checked={form.tutor.virtual_available}
                    onChange={(checked) =>
                      set('tutor', { ...form.tutor, virtual_available: checked })
                    }
                  />

                  {/* What the tutor is PAID. A per-student override on the
                      assignment beats these. Not what the family is charged --
                      that is priced on the student, below. */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="t_rate_ip"
                      label="In-person rate / hr"
                      hint="Used unless an assignment overrides it."
                    >
                      <Input
                        id="t_rate_ip"
                        inputMode="decimal"
                        value={form.tutor.rate_in_person}
                        onChange={(e) =>
                          set('tutor', { ...form.tutor, rate_in_person: e.target.value })
                        }
                        placeholder="75.00"
                      />
                    </Field>
                    <Field id="t_rate_v" label="Virtual rate / hr" optional>
                      <Input
                        id="t_rate_v"
                        inputMode="decimal"
                        value={form.tutor.rate_virtual}
                        onChange={(e) =>
                          set('tutor', { ...form.tutor, rate_virtual: e.target.value })
                        }
                        placeholder="65.00"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <SessionLimitField
                      id="t_max_session"
                      value={form.tutor.max_minutes}
                      onChange={(value) => set('tutor', { ...form.tutor, max_minutes: value })}
                      hint="A running session that reaches this is recorded at it and flagged, so a timer left on does not bill the rest of the night."
                    />

                    {/* The institute pays most tutors up front. This is the
                        level their unworked balance is kept above, not a
                        payment: recording the payment itself is a separate
                        act, on the billing page. */}
                    <Field
                      id="t_topup"
                      label="Top up below"
                      optional
                      hint="Blank means this tutor is paid for work already done, never in advance."
                    >
                      <Input
                        id="t_topup"
                        inputMode="decimal"
                        value={form.tutor.topup}
                        onChange={(e) => set('tutor', { ...form.tutor, topup: e.target.value })}
                        placeholder="100.00"
                      />
                    </Field>
                  </div>
                </>
              )}

              {isStudent && (
                <>
                  <Separator />
                  <SectionHeading title="Student details" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="s_school" label="School">
                      <Input
                        id="s_school"
                        value={form.student.school}
                        onChange={(e) =>
                          set('student', { ...form.student, school: e.target.value })
                        }
                        placeholder="Culbreth Middle"
                      />
                    </Field>
                    <Field id="s_course" label="Current math course / grade">
                      <Input
                        id="s_course"
                        value={form.student.current_math_course}
                        onChange={(e) =>
                          set('student', { ...form.student, current_math_course: e.target.value })
                        }
                        placeholder="Grade 7 Mathematics"
                      />
                    </Field>
                  </div>
                  <Field id="s_goal" label="Goal for this academic year">
                    <Input
                      id="s_goal"
                      value={form.student.academic_year_goal}
                      onChange={(e) =>
                        set('student', { ...form.student, academic_year_goal: e.target.value })
                      }
                      placeholder="Move up to the accelerated track"
                    />
                  </Field>
                  <Checkbox
                    id="s_virtual"
                    label="Available for virtual tutoring"
                    checked={form.student.virtual_available}
                    onChange={(checked) =>
                      set('student', { ...form.student, virtual_available: checked })
                    }
                  />

                  {/* What the FAMILY is charged. Priced on the student, so it
                      does not change with whoever happens to teach them; the
                      institute keeps the difference from the tutor's rate. */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id="s_charge_ip"
                      label="In-person price / hr"
                      hint="Charged to the family. A session cannot be recorded without it."
                    >
                      <Input
                        id="s_charge_ip"
                        inputMode="decimal"
                        value={form.student.charge_in_person}
                        onChange={(e) =>
                          set('student', { ...form.student, charge_in_person: e.target.value })
                        }
                        placeholder="95.00"
                      />
                    </Field>
                    <Field id="s_charge_v" label="Virtual price / hr" optional>
                      <Input
                        id="s_charge_v"
                        inputMode="decimal"
                        value={form.student.charge_virtual}
                        onChange={(e) =>
                          set('student', { ...form.student, charge_virtual: e.target.value })
                        }
                        placeholder="85.00"
                      />
                    </Field>
                  </div>

                  <SessionLimitField
                    id="s_max_session"
                    value={form.student.max_minutes}
                    onChange={(value) => set('student', { ...form.student, max_minutes: value })}
                    hint="The shorter of this and the tutor's limit is the one that applies."
                  />
                </>
              )}

              {(isTutor || isStudent) && (
                <>
                  <Separator />
                  <AvailabilityPicker
                    value={form.availability}
                    onChange={(slots) => set('availability', slots)}
                  />
                </>
              )}

              {(isTutor || isParent) && (
                <>
                  <Separator />
                  <PaymentHandlesField
                    value={form.payment_handles}
                    onChange={(handles) => set('payment_handles', handles)}
                    hint={
                      isTutor && isParent
                        ? 'Used both to pay them as a tutor and to bill them as a parent.'
                        : isTutor
                          ? 'How this tutor is paid.'
                          : 'How this parent is billed.'
                    }
                  />
                </>
              )}

              {(isStudent || isTutor) && (
                <>
                  <Separator />
                  <GuardianPicker
                    value={form.guardians}
                    onChange={(links) => set('guardians', links)}
                    excludeUserId={userId ?? undefined}
                    error={errors.guardians}
                    required={isStudent}
                  />
                </>
              )}

              {errors._ && (
                <p role="alert" className="text-destructive text-xs">
                  {errors._}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || (isEdit && loadingDetail)}>
              {saving && <Loader2Icon className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Add user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h3>;
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-primary size-4"
      />
      {label}
    </label>
  );
}

/**
 * The longest a single lesson may run. Offered as a choice rather than a typed
 * number because the value has to be a multiple of a quarter hour, which is
 * the unit sessions are recorded in.
 */
function SessionLimitField({
  id,
  value,
  onChange,
  hint,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  return (
    <Field id={id} label="Longest session" hint={hint} optional>
      <Select value={value || NO_LIMIT} onValueChange={(v) => onChange(v === NO_LIMIT ? '' : v)}>
        <SelectTrigger id={id} className="w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_LIMIT}>
            No limit of their own ({formatDuration(DEFAULT_MAX_SESSION_MINUTES)})
          </SelectItem>
          {SESSION_LIMIT_CHOICES.map((minutes) => (
            <SelectItem key={minutes} value={String(minutes)}>
              {formatDuration(minutes)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

/** Radix cannot hold an empty option value, so absence needs a name. */
const NO_LIMIT = 'none';

function Field({
  id,
  label,
  error,
  optional,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // content-start, not the default stretch: a grid row sizes every field in
    // it to the tallest, and a field carrying a hint or an error is taller. Let
    // the rows stretch and the inputs beside it drift down out of line with it.
    <div className="grid content-start gap-2">
      <Label htmlFor={id} className={cn(error && 'text-destructive')}>
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
