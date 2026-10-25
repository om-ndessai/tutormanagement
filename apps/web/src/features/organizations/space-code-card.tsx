import { useState } from 'react';
import { toast } from 'sonner';
import { CopyIcon, RefreshCwIcon, Share2Icon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-provider';
import { useDeleteSpace, useLeaveSpace, useRenewSpaceCode, useSetJoinByCode, useSpaceCode } from './api';
import { NotificationsSwitch } from './notifications-switch';

/**
 * Phase 52: the space's code, for its admins: copy it, share it, make a new one (the old stops
 * working at once), and switch joining by code on or off. People who use it ask to join; the
 * admins let them in from the People page.
 */
export function SpaceCodeCard() {
  const { organization } = useAuth();
  const code = useSpaceCode(true);
  const renew = useRenewSpaceCode();
  const setJoining = useSetJoinByCode();
  const value = code.data?.data;
  const shareText = value?.code ? `Join ${organization?.name} on Aimtrue with the code ${value.code}.` : '';

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: organization?.name ?? 'Aimtrue', text: shareText, url: window.location.origin });
        return;
      } catch {
        // Closed the sheet: nothing to do.
        return;
      }
    }
    await navigator.clipboard.writeText(`${shareText} ${window.location.origin}`);
    toast.success('Invitation copied.');
  }

  return (
    <Card className="py-0" data-testid="space-code">
      <CardContent className="grid gap-3 p-5">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Space code</h2>
        {value?.code ? (
          <p className="font-mono text-2xl font-semibold tracking-widest" data-testid="space-code-value">
            {value.code}
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">No code yet. Make one to let people ask to join.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {value?.code && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void navigator.clipboard.writeText(value.code!).then(() => toast.success('Code copied.'))}
              >
                <CopyIcon /> Copy
              </Button>
              <Button size="sm" variant="outline" onClick={() => void share()}>
                <Share2Icon /> Share
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={renew.isPending}
            onClick={() =>
              renew.mutate(undefined, {
                onSuccess: () => toast.success(value?.code ? 'New code made. The old one no longer works.' : 'Code made.'),
              })
            }
            data-testid="space-code-renew"
          >
            <RefreshCwIcon /> {value?.code ? 'Make a new code' : 'Make a code'}
          </Button>
        </div>
        <div className="flex items-start gap-3 border-t pt-3">
          <div className="grid flex-1 gap-0.5">
            <label htmlFor="space-joining" className="text-sm font-medium">
              Let people ask to join with the code
            </label>
            <p className="text-muted-foreground text-xs">You decide who comes in, on the People page.</p>
          </div>
          <NotificationsSwitch
            label="Let people ask to join with the code"
            id="space-joining"
            checked={value?.join_by_code ?? false}
            disabled={setJoining.isPending || code.isPending}
            onCheckedChange={(on) => setJoining.mutate(on, { onSuccess: () => toast.success(on ? 'Joining by code is on.' : 'Joining by code is off.') })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Phase 52: leaving the space, and -- for a space made here -- deleting it with everything in it. */
export function SpaceDangerCard() {
  const { organization, user } = useAuth();
  const leave = useLeaveSpace();
  const remove = useDeleteSpace();
  const [confirm, setConfirm] = useState('');
  if (!organization) return null;
  const selfServe = organization.created_via === 'self_serve' && Boolean(user?.roles.includes('admin'));
  const fail = (e: unknown, fallback: string) => toast.error(e instanceof ApiRequestError ? e.message : fallback);

  return (
    <Card className="border-destructive/30 py-0" data-testid="space-danger">
      <CardContent className="grid gap-4 p-5 text-sm">
        <div className="grid gap-2">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Leave</h2>
          <p className="text-muted-foreground">You stop being a member of {organization.name}. Its records of you stay.</p>
          <div>
            <Button
              size="sm"
              variant="outline"
              disabled={leave.isPending}
              onClick={() => leave.mutate(undefined, { onSuccess: () => window.location.assign('/'), onError: (e) => fail(e, 'Could not leave.') })}
              data-testid="space-leave"
            >
              Leave {organization.short_name}
            </Button>
          </div>
        </div>
        {selfServe && (
          <div className="grid gap-2 border-t pt-3">
            <h2 className="text-destructive text-xs font-semibold tracking-wide uppercase">Delete the space</h2>
            <p className="text-muted-foreground">
              Everything in it goes: its people’s places, its assessments and their PDFs, its activity. Children added here
              with no account of their own are removed too. This cannot be undone. Type its name to confirm.
            </p>
            <div className="flex flex-wrap gap-2">
              <Input
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder={organization.name}
                className="max-w-xs"
                data-testid="space-delete-name"
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={confirm.trim().toLowerCase() !== organization.name.trim().toLowerCase() || remove.isPending}
                onClick={() =>
                  remove.mutate(confirm, { onSuccess: () => window.location.assign('/'), onError: (e) => fail(e, 'Could not delete the space.') })
                }
                data-testid="space-delete"
              >
                Delete {organization.short_name}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
