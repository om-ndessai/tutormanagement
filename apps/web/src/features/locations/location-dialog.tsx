import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  LOCATION_KINDS,
  LOCATION_KIND_LABELS,
  MAX_REMINDER_MINUTES,
  type Location,
  type LocationKind,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiRequestError } from '@/lib/api-client';
import { useCreateLocation, useUpdateLocation } from './api';

/** Add or edit one of a person's locations. */
export function LocationDialog({
  open,
  onOpenChange,
  ownerId,
  ownerName,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerName: string;
  existing: Location | null;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocationKind>('physical');
  const [address, setAddress] = useState('');
  const [reminder, setReminder] = useState('0');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useCreateLocation();
  const update = useUpdateLocation();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setName(existing?.name ?? '');
    setKind(existing?.kind ?? 'physical');
    setAddress(existing?.address ?? '');
    setReminder(String(existing?.reminder_minutes ?? 0));
  }, [open, existing]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const minutes = Number(reminder);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > MAX_REMINDER_MINUTES) {
      setErrors({ reminder_minutes: 'Use whole minutes, from 0 (no reminder) up to a day.' });
      return;
    }
    const fields = { name: name.trim(), kind, address: address.trim() || null, reminder_minutes: minutes };
    try {
      if (existing) await update.mutateAsync({ id: existing.id, input: fields });
      else await create.mutateAsync({ owner_user_id: ownerId, ...fields });
      toast.success(existing ? 'Location updated.' : 'Location added.');
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
        return;
      }
      toast.error('Could not save the location.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit location' : 'Add a location'}</DialogTitle>
            <DialogDescription>Where {ownerName} likes to have lessons.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Row id="loc-name" label="Name" error={errors.name}>
              <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Main library, room 2" />
            </Row>
            <Row id="loc-kind" label="Type" error={errors.kind}>
              <Select value={kind} onValueChange={(value) => setKind(value as LocationKind)}>
                <SelectTrigger id="loc-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCATION_KINDS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {LOCATION_KIND_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row
              id="loc-address"
              label={kind === 'virtual' ? 'Meeting link or instructions' : 'Address'}
              optional
              error={errors.address}
            >
              <Input
                id="loc-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={kind === 'virtual' ? 'https://meet.example.com/…' : '123 Main St, Cary NC'}
              />
            </Row>
            <Row
              id="loc-reminder"
              label="Reminder, minutes before"
              error={errors.reminder_minutes}
              hint="0 means no reminder. The app and the portal remind everyone in the lesson."
            >
              <Input
                id="loc-reminder"
                type="number"
                min={0}
                max={MAX_REMINDER_MINUTES}
                step={5}
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
              />
            </Row>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              {existing ? 'Save changes' : 'Add location'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({
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
