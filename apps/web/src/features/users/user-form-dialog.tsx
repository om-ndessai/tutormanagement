import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  createUserSchema,
  type User,
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
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useCreateUser, useUpdateUser } from './api';

interface FormState {
  email: string;
  full_name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
}

const EMPTY_FORM: FormState = {
  email: '',
  full_name: '',
  phone: '',
  role: 'tutor',
  status: 'active',
};

function toFormState(user: User | null): FormState {
  if (!user) return EMPTY_FORM;

  return {
    email: user.email,
    full_name: user.full_name,
    phone: user.phone ?? '',
    role: user.role,
    status: user.status,
  };
}

/**
 * One dialog for both create and edit: passing a `user` switches it to edit
 * mode. Validation runs against the same Zod schema the Worker uses, so the
 * two can never drift.
 */
export function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}) {
  const isEdit = user !== null;
  const [form, setForm] = useState<FormState>(() => toFormState(user));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const isPending = createUser.isPending || updateUser.isPending;

  // Reset whenever the dialog is opened for a different record.
  useEffect(() => {
    if (open) {
      setForm(toFormState(user));
      setErrors({});
    }
  }, [open, user]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const { [key as string]: _removed, ...rest } = previous;
      return rest;
    });
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = createUserSchema.safeParse(form);

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.');
        fieldErrors[key] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      if (isEdit) {
        await updateUser.mutateAsync({ id: user.id, input: parsed.data });
        toast.success(`${parsed.data.full_name} updated.`);
      } else {
        await createUser.mutateAsync(parsed.data);
        toast.success(`${parsed.data.full_name} added.`);
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit user' : 'Add user'}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? 'Update this staff member’s details.'
                : 'Add an admin or tutor to the institute directory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <Field id="full_name" label="Full name" error={errors.full_name}>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(event) => setField('full_name', event.target.value)}
                aria-invalid={Boolean(errors.full_name)}
                autoComplete="name"
                placeholder="Alex Chen"
              />
            </Field>

            <Field id="email" label="Email" error={errors.email}>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => setField('email', event.target.value)}
                aria-invalid={Boolean(errors.email)}
                autoComplete="email"
                placeholder="alex@trianglemathinstitute.com"
              />
            </Field>

            <Field id="phone" label="Phone" error={errors.phone} optional>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => setField('phone', event.target.value)}
                aria-invalid={Boolean(errors.phone)}
                autoComplete="tel"
                placeholder="(919) 555-0142"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="role" label="Role" error={errors.role}>
                <Select
                  value={form.role}
                  onValueChange={(value) => setField('role', value as UserRole)}
                >
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {USER_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field id="status" label="Status" error={errors.status}>
                <Select
                  value={form.status}
                  onValueChange={(value) => setField('status', value as UserStatus)}
                >
                  <SelectTrigger id="status" className="w-full">
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
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2Icon className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Add user'}
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
  optional,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className={cn(error && 'text-destructive')}>
        {label}
        {optional && <span className="text-muted-foreground font-normal">(optional)</span>}
      </Label>
      {children}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
