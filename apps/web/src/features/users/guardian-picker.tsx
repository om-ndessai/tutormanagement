import { PlusIcon, XIcon } from 'lucide-react';
import {
  RELATIONSHIPS,
  RELATIONSHIP_LABELS,
  type GuardianshipInput,
  type Relationship,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUsers } from './api';

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

  const candidates = (data?.data ?? []).filter(
    (candidate) =>
      candidate.id !== excludeUserId && !value.some((link) => link.guardian_user_id === candidate.id),
  );

  const nameFor = (id: string) =>
    data?.data.find((candidate) => candidate.id === id)?.full_name ?? 'Unknown';

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
        Only people who already have the Parent role can be selected.
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

      {candidates.length > 0 ? (
        <Select value="" onValueChange={add}>
          <SelectTrigger className="w-full" aria-label="Add a parent or guardian">
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
              : 'No users have the Parent role yet. Create the parent first.'}
        </p>
      )}

      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
