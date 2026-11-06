import { useState } from 'react';
import { toast } from 'sonner';
import { CheckIcon, CopyIcon, Loader2Icon, PlusIcon, Share2Icon, XIcon } from 'lucide-react';
import {
  USER_ROLE_LABELS,
  invitationText,
  inviteRolesFor,
  spaceInviteRowSchema,
  type SpaceInviteRole,
  type SpaceInviteRow,
} from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useInvitePerson } from './api';
import { SpaceCodeCard } from './space-code-card';

interface Row {
  key: number;
  email: string;
  full_name: string;
  role: SpaceInviteRole;
  problem: string | null;
}

let nextKey = 1;
const blankRow = (): Row => ({ key: nextKey++, email: '', full_name: '', role: 'parent', problem: null });

/**
 * The words an invitation hands over, for `email` (Phase 76, JF37): who invites, the space and what it is for, where
 * to go and the address to sign in with. Shared by this step and the Users page's invited rows.
 */
export function useInvitationText() {
  const { user, organization } = useAuth();
  return (email: string) =>
    invitationText({
      inviter: user?.full_name ?? 'Someone',
      space: organization?.name ?? 'a space',
      // The link opens on the invitation (the person's Spaces page), not on the guest game page (UI audit JF12).
      address: `${window.location.origin}/spaces`,
      email,
      org: organization,
    });
}

/** Copy an invitation's words, said so (JF37). */
export async function copyInvitation(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success('Invitation copied.');
  } catch {
    toast.error('Could not copy. Select the text and copy it instead.');
  }
}

/** Share an invitation's words through the device's own sheet, else copy them; said either way (JF37). */
export async function shareInvitation(text: string, title: string): Promise<void> {
  if (!navigator.share) {
    await copyInvitation(text);
    return;
  }
  try {
    await navigator.share({ title, text });
    toast.success('Invitation shared.');
  } catch {
    // Closed the sheet: nothing to do.
  }
}

/**
 * Phase 61 (S12, docs/spaces-plan.md): "Invite people", right after starting a space and before
 * the welcome tour. Rows of email and role (Admin, Parent, and Tutor only where Tutoring is
 * allowed); each row is the ordinary add-person request, so the per-minute limit and the daily cap
 * apply, and the person is invited and accepts. A self-serve space sends no email, so each
 * invitation is copied or shared by hand; the space's code is shown too. Students are added in the
 * wizard's "Add a student", and the same rows are always on People -> Add person.
 */
export function InvitePeople({ onDone, doneLabel }: { onDone: () => void; doneLabel?: string }) {
  const { organization } = useAuth();
  const invite = useInvitePerson();
  const roles = inviteRolesFor(organization);
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);
  const [sent, setSent] = useState<SpaceInviteRow[]>([]);
  const [sending, setSending] = useState(false);
  const textFor = useInvitationText();

  const update = (key: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch, problem: null } : row)));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    const left: Row[] = [];
    const done: SpaceInviteRow[] = [];
    for (const row of rows) {
      if (!row.email.trim() && !row.full_name.trim()) continue;
      const parsed = spaceInviteRowSchema.safeParse({
        email: row.email,
        full_name: row.full_name || undefined,
        role: row.role,
      });
      if (!parsed.success) {
        left.push({ ...row, problem: parsed.error.issues[0]?.message ?? 'Check this row.' });
        continue;
      }
      try {
        await invite.mutateAsync(parsed.data);
        done.push(parsed.data);
      } catch (caught) {
        const problem =
          caught instanceof ApiRequestError
            ? caught.status === 409
              ? 'Already in this space.'
              : (caught.fieldErrors.email ?? caught.fieldErrors.roles ?? caught.message)
            : 'Could not invite them. Try again.';
        left.push({ ...row, problem });
      }
    }
    setSending(false);
    // One entry per address: someone invited again (after leaving, say) replaces their earlier line.
    setSent((current) => [...current.filter((row) => !done.some((d) => d.email === row.email)), ...done]);
    setRows(left.length > 0 ? left : [blankRow()]);
    if (done.length > 0) toast.success(done.length === 1 ? 'Invitation made.' : `${done.length} invitations made.`);
  }

  const copy = (email: string) => copyInvitation(textFor(email));
  const share = (email: string) => shareInvitation(textFor(email), organization?.name ?? 'Aimtrue');

  const anyTyped = rows.some((row) => row.email.trim() || row.full_name.trim());

  return (
    <div className="grid gap-4" data-testid="invite-step">
      <form className="grid gap-3" onSubmit={send} aria-label="Invite people" noValidate>
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-2 rounded-lg border p-3" data-testid={`invite-row-${index}`}>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto] sm:items-end">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`invite-email-${row.key}`}>Email</Label>
                <Input
                  id={`invite-email-${row.key}`}
                  type="email"
                  autoComplete="off"
                  value={row.email}
                  placeholder="name@example.com"
                  onChange={(event) => update(row.key, { email: event.target.value })}
                  data-testid={`invite-email-${index}`}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`invite-name-${row.key}`}>Name (optional)</Label>
                <Input
                  id={`invite-name-${row.key}`}
                  autoComplete="off"
                  value={row.full_name}
                  onChange={(event) => update(row.key, { full_name: event.target.value })}
                  data-testid={`invite-name-${index}`}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`invite-role-${row.key}`}>Role</Label>
                <Select value={row.role} onValueChange={(value) => update(row.key, { role: value as SpaceInviteRole })}>
                  <SelectTrigger id={`invite-role-${row.key}`} className="w-full" data-testid={`invite-role-${index}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role} data-testid={`invite-role-option-${role}`}>
                        {USER_ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this row"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                >
                  <XIcon />
                </Button>
              )}
            </div>
            {row.problem && (
              <p className="text-destructive text-sm" role="alert" data-testid={`invite-problem-${index}`}>
                {row.problem}
              </p>
            )}
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, blankRow()])} data-testid="invite-add-row">
            <PlusIcon /> Another person
          </Button>
          <Button type="submit" size="sm" disabled={!anyTyped || sending} data-testid="invite-send">
            {sending && <Loader2Icon className="animate-spin" />}
            Invite
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Children are added as students next, with Add a student. You can invite more people any time from People.
        </p>
      </form>

      {sent.length > 0 && (
        <section className="grid gap-2" aria-label="Invited">
          <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Invited</h3>
          <p className="text-muted-foreground text-xs">
            No email is sent from this space. Copy each invitation, or share it, so they know to sign in.
          </p>
          {sent.map((row) => (
            <div
              key={row.email}
              className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
              data-testid={`invite-sent-${row.email}`}
            >
              <CheckIcon className="text-success size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {row.email} <span className="text-muted-foreground">· {USER_ROLE_LABELS[row.role]}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => void copy(row.email)} data-testid={`invite-copy-${row.email}`}>
                <CopyIcon /> Copy invitation
              </Button>
              <Button size="sm" variant="outline" onClick={() => void share(row.email)} data-testid={`invite-share-${row.email}`}>
                <Share2Icon /> Share
              </Button>
            </div>
          ))}
        </section>
      )}

      <SpaceCodeCard />

      <div className="flex justify-end">
        {sent.length > 0 ? (
          <Button onClick={onDone} data-testid="invite-continue">
            {doneLabel ?? 'Continue'}
          </Button>
        ) : (
          <Button variant="ghost" onClick={onDone} data-testid="invite-skip">
            {doneLabel ? 'Close' : 'Skip'}
          </Button>
        )}
      </div>
    </div>
  );
}
