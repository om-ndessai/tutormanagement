import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import {
  PLACEMENT_QUEST_OFF,
  PLACEMENT_ROLES,
  PLACEMENT_ROLE_LABELS,
  placementWords,
  type AccessAccount,
  type PlacementRole,
  type PlacementSpace,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiRequestError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useDecideAccess, usePlacementSpaces } from './api';

/** The most spaces the picker lists at once; typing narrows it. */
const SHOWN = 50;

/** One line under each role. */
const ROLE_HINTS: Record<PlacementRole, string> = {
  member: 'Plays Quest there, with no role until its admins give one.',
  admin: 'Helps run the space: adds people, starts assessments.',
};

/**
 * Phase 80 (A11, A15, docs/members-plan.md): approving a sign-up, with an optional place. A space made in the console
 * joins them at once (as Member, or Admin -- never for a 13-17); a self-started space gets a request to join filed for
 * them, which its admins answer. Nowhere (the default): their own space is made, as before. The sheet says what will
 * happen in words, and warns where Quest is off. The list of spaces is a read across spaces, so it is fetched only
 * while this sheet is open (it is mounted only then).
 */
export function ApproveSheet({ account, onClose }: { account: AccessAccount; onClose: () => void }) {
  const decide = useDecideAccess();
  const spaces = usePlacementSpaces(true);
  const [query, setQuery] = useState('');
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [role, setRole] = useState<PlacementRole>('member');
  const [problem, setProblem] = useState<string | null>(null);

  const all = useMemo(() => spaces.data?.data ?? [], [spaces.data]);
  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((space) => `${space.name} ${space.short_name}`.toLowerCase().includes(needle)) : all;
  }, [all, query]);
  const shown = matching.slice(0, SHOWN);
  const space: PlacementSpace | null = all.find((candidate) => candidate.id === spaceId) ?? null;
  const first = account.full_name.trim().split(/\s+/)[0] || account.full_name;
  const roles = PLACEMENT_ROLES.filter(
    (choice) => choice === 'member' || (space?.created_via === 'console' && account.age_band !== '13-17'),
  );
  const chosenRole: PlacementRole = roles.includes(role) ? role : 'member';
  const choose = (id: string | null) => {
    setSpaceId(id);
    setRole('member');
  };

  async function approve() {
    setProblem(null);
    try {
      await decide.mutateAsync({
        userId: account.user_id,
        access: 'approved',
        ...(space ? { space: { organization_id: space.id, role: chosenRole } } : {}),
      });
      toast.success(`${account.full_name} approved.`);
      onClose();
    } catch (caught) {
      setProblem(caught instanceof ApiRequestError ? caught.message : 'That could not be saved.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" data-testid="access-approve-sheet">
        <DialogHeader>
          <DialogTitle>Approve {account.full_name}</DialogTitle>
          <DialogDescription>
            {account.email} · {account.age_band === 'adult' ? 'Adult' : 'Age 13-17'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-w-0 gap-1.5">
          {/* cmdk labels its own input (`label`, for screen readers); this is the same words on screen. */}
          <p className="text-sm font-medium" aria-hidden data-testid="access-approve-place-label">
            Place them in a space (optional)
          </p>
          {/* Filtered here, on name and short name: cmdk's own fuzzy match would also match an id's letters. */}
          <Command shouldFilter={false} label="Place them in a space (optional)" className="rounded-lg border">
            <CommandInput
              placeholder="Search spaces…"
              value={query}
              onValueChange={setQuery}
              data-testid="access-approve-search"
            />
            <CommandList className="max-h-56">
              <CommandGroup>
                <CommandItem
                  value="__nowhere__"
                  onSelect={() => choose(null)}
                  data-chosen={spaceId === null}
                  data-testid="access-approve-nowhere"
                >
                  <CheckIcon className={cn('size-4', spaceId === null ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">Nowhere: they get a space of their own</span>
                </CommandItem>
                {shown.map((candidate) => (
                  <CommandItem
                    key={candidate.id}
                    value={candidate.id}
                    onSelect={() => choose(candidate.id)}
                    data-chosen={spaceId === candidate.id}
                    data-testid={`access-approve-space-${candidate.id}`}
                  >
                    <CheckIcon className={cn('size-4', spaceId === candidate.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1">
                      <span className="block break-words">{candidate.name}</span>
                      <span className="text-muted-foreground block text-xs">
                        {candidate.created_via === 'console' ? 'Joins at once' : 'Its admins let them in'}
                        {!candidate.quest_on && ' · Quest off'}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <p className="text-muted-foreground text-xs" data-testid="access-approve-list-note">
            {spaces.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2Icon className="size-3 animate-spin" /> Loading spaces…
              </span>
            ) : spaces.isError ? (
              'The spaces could not be loaded. Approving now gives them a space of their own.'
            ) : matching.length === 0 && query.trim() ? (
              <span data-testid="access-approve-none">No space has that name.</span>
            ) : matching.length > shown.length ? (
              `Showing ${shown.length} of ${matching.length}. Type to narrow.`
            ) : null}
          </p>
        </div>

        {space && (
          <div className="grid gap-3" data-testid="access-approve-place">
            <fieldset className="grid gap-2" data-testid="access-approve-role">
              <legend className="mb-1 text-sm font-medium">Their role there</legend>
              {roles.map((choice) => (
                <Label
                  key={choice}
                  htmlFor={`access-approve-role-${choice}`}
                  className="hover:bg-muted/50 has-[:checked]:border-primary flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal"
                >
                  <input
                    type="radio"
                    name="access-approve-role"
                    id={`access-approve-role-${choice}`}
                    value={choice}
                    checked={chosenRole === choice}
                    onChange={() => setRole(choice)}
                    className="accent-primary mt-1 size-4"
                    data-testid={`access-approve-role-${choice}`}
                  />
                  <span className="grid gap-0.5">
                    <span className="font-medium">{PLACEMENT_ROLE_LABELS[choice]}</span>
                    <span className="text-muted-foreground text-sm">{ROLE_HINTS[choice]}</span>
                  </span>
                </Label>
              ))}
            </fieldset>
            <p className="bg-muted/60 rounded-lg px-3 py-2 text-sm" data-testid="access-approve-words">
              {placementWords(space, first)}
            </p>
            {!space.quest_on && (
              <p
                className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                role="note"
                data-testid="access-approve-quest-off"
              >
                <TriangleAlertIcon className="text-warning-foreground dark:text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                {PLACEMENT_QUEST_OFF}
              </p>
            )}
          </div>
        )}

        {problem && (
          <p className="text-destructive text-sm" role="alert" data-testid="access-approve-problem">
            {problem}
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void approve()} disabled={decide.isPending} data-testid="access-approve-confirm">
            {decide.isPending && <Loader2Icon className="animate-spin" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
