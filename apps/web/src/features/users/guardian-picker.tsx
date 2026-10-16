import { useState } from 'react';
import { Loader2Icon, PlusIcon, UserPlusIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  createUserRequestSchema,
  type GuardianshipInput,
  type Relationship,
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
import { ApiRequestError } from '@/lib/api-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useCreateUser, useUsers } from './api';

type GuardianValue = Required<GuardianshipInput>;

/**
 * Picks the adults responsible for this person. Backs two rules from the plan
 * at once: every student must have at least one, and a tutor who is still a
 * minor may have one too.
 *
 * Only users who already hold the parent role can be chosen, so the link
 * cannot claim someone is a parent while their record says otherwise.
 */
export function GuardianPicker({
  value,
  onChange,
  excludeUserId,
  error,
  required,
}: {
  value: GuardianValue[];
  onChange: (links: GuardianValue[]) => void;
  /** The person being edited, who must not appear in their own guardian list. */
  excludeUserId?: string | undefined;
  error?: string;
  required?: boolean;
}) {
  const { data, isPending } = useUsers({ role: 'parent', limit: 100, sort: 'full_name' });
  const [creating, setCreating] = useState(false);
  // A parent added here is not in the list until it refetches; keep their name meanwhile.
  const [added, setAdded] = useState<Record<string, string>>({});

  const candidates = (data?.data ?? []).filter(
    (candidate) =>
      candidate.id !== excludeUserId && !value.some((link) => link.guardian_user_id === candidate.id),
  );

  const nameFor = (id: string) =>
    data?.data.find((candidate) => candidate.id === id)?.full_name ?? added[id] ?? 'Unknown';

  function add(guardianUserId: string) {
    onChange([
      ...value,
      {
        guardian_user_id: guardianUserId,
        relationship: 'guardian',
        // The first one added becomes the primary contact by default.
        is_primary: value.length === 0,
      },
    ]);
  }

  function update(id: string, patch: Partial<GuardianValue>) {
    onChange(
      value.map((link) =>
        link.guardian_user_id === id
          ? { ...link, ...patch }
          : // Only one guardian can be primary.
            patch.is_primary
            ? { ...link, is_primary: false }
            : link,
      ),
    );
  }

  function remove(id: string) {
    const remaining = value.filter((link) => link.guardian_user_id !== id);

    // Never leave a set of guardians with nobody marked primary.
    if (remaining.length > 0 && !remaining.some((link) => link.is_primary)) {
      remaining[0] = { ...remaining[0]!, is_primary: true };
    }

    onChange(remaining);
  }

  return (
    <div className="grid gap-2">
      <span className={cn('text-sm font-medium', error && 'text-destructive')}>
        Parents / guardians
        {required && <span className="text-destructive"> *</span>}
      </span>
      <p className="text-muted-foreground -mt-1 text-xs">
        Choose a parent already in the portal, or add a new one here.
      </p>

      {value.length > 0 && (
        <ul className="grid gap-2">
          {value.map((link) => (
            <li
              key={link.guardian_user_id}
              className="flex flex-wrap items-center gap-2 rounded-md border p-2"
            >
              <span className="min-w-32 flex-1 truncate text-sm font-medium">
                {nameFor(link.guardian_user_id)}
              </span>

              <Select
                value={link.relationship}
                onValueChange={(next) =>
                  update(link.guardian_user_id, { relationship: next as Relationship })
                }
              >
                <SelectTrigger className="w-32" aria-label="Relationship">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((relationship) => (
                    <SelectItem key={relationship} value={relationship}>
                      {RELATIONSHIP_LABELS[relationship]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="primary-guardian"
                  checked={link.is_primary}
                  onChange={() => update(link.guardian_user_id, { is_primary: true })}
                  className="accent-primary size-3.5"
                />
                Primary
              </label>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${nameFor(link.guardian_user_id)}`}
                onClick={() => remove(link.guardian_user_id)}
              >
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-start gap-2">
      {candidates.length > 0 ? (
        <Select value="" onValueChange={add}>
          <SelectTrigger className="min-w-0 flex-1" aria-label="Add a parent or guardian">
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <PlusIcon className="size-4" />
              Add a parent or guardian
            </span>
          </SelectTrigger>
          {/*
            Popper positioning, not the default item-aligned: this select has
            no chosen value to align to, so item-aligned drops the list off the
            bottom of the window and it cannot be clicked.
          */}
          <SelectContent position="popper" align="start">
            {candidates.map((candidate) => (
              <SelectItem key={candidate.id} value={candidate.id}>
                {candidate.full_name}
                <span className="text-muted-foreground ml-2 text-xs">{candidate.email}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-muted-foreground text-xs">
          {isPending
            ? 'Loading…'
            : value.length > 0
              ? 'No other parents available.'
              : 'No parents in the portal yet. Add one with New parent.'}
        </p>
      )}
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
          <UserPlusIcon className="size-4" /> New parent…
        </Button>
      </div>

      <NewParentDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id, name) => {
          setAdded((current) => ({ ...current, [id]: name }));
          add(id);
        }}
      />

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Adds a parent without leaving the student's form (UI upgrades U3). The parent is created on its
 * own (`POST /users`, role parent), then chosen in the picker; the student and their guardians are
 * still sent in one request when the outer form is saved, so the guardian rule is unchanged.
 */
function NewParentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string, name: string) => void;
}) {
  const createUser = useCreateUser();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset(next: boolean) {
    if (!next) {
      setName('');
      setEmail('');
      setPhone('');
      setErrors({});
    }
    onOpenChange(next);
  }

  async function save(event: React.FormEvent) {
    // The parent's dialog sits inside the student's form: never submit that one.
    event.preventDefault();
    event.stopPropagation();
    const parsed = createUserRequestSchema.safeParse({
      full_name: name,
      email,
      phone: phone || null,
      roles: ['parent'],
    });
    if (!parsed.success) {
      const found: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? '_');
        found[key] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    try {
      const saved = await createUser.mutateAsync(parsed.data as never);
      toast.success(`${saved.data.full_name} added as a parent.`);
      onCreated(saved.data.id, saved.data.full_name);
      reset(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not add the parent.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={save} noValidate data-testid="new-parent-form">
          <DialogHeader>
            <DialogTitle>New parent</DialogTitle>
            <DialogDescription>They sign in with this Google address and are billed for the lessons.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {(
              [
                ['new-parent-name', 'Full name', name, setName, 'full_name', 'text'],
                ['new-parent-email', 'Email', email, setEmail, 'email', 'email'],
                ['new-parent-phone', 'Phone (optional)', phone, setPhone, 'phone', 'tel'],
              ] as const
            ).map(([id, label, value, setValue, key, type]) => (
              <div key={id} className="grid gap-2">
                <Label htmlFor={id} className={errors[key] ? 'text-destructive' : undefined}>
                  {label}
                </Label>
                <Input
                  id={id}
                  type={type}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  aria-invalid={Boolean(errors[key])}
                />
                {errors[key] && (
                  <p role="alert" className="text-destructive text-xs">
                    {errors[key]}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => reset(false)} disabled={createUser.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2Icon className="animate-spin" />}
              Add parent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
