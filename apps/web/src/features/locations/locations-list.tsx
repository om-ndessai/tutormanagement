import { useState } from 'react';
import { BellIcon, GlobeIcon, MapPinIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { LOCATION_KIND_LABELS, type Location } from '@tmi/shared';

import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api-client';
import { useDeleteLocation, useLocations } from './api';
import { LocationDialog } from './location-dialog';

/** A tutor's or a student's own locations, with add, edit and remove (Phase 33). */
export function LocationsList({ ownerId, ownerName }: { ownerId: string; ownerName: string }) {
  const { data, isLoading } = useLocations(ownerId);
  const remove = useDeleteLocation();
  const [editing, setEditing] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const locations = data?.data ?? [];

  async function removeLocation(location: Location) {
    try {
      await remove.mutateAsync(location.id);
      toast.success(`Removed ${location.name}.`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove the location.');
    }
  }

  return (
    <div className="grid gap-3" data-testid="locations-list">
      {isLoading ? null : locations.length === 0 ? (
        <p className="text-muted-foreground text-sm">No locations yet.</p>
      ) : (
        <ul className="grid min-w-0 gap-2">
          {locations.map((location) => (
            <li key={location.id} className="flex min-w-0 items-start gap-3 text-sm" data-testid={`location-${location.id}`}>
              {location.kind === 'virtual' ? (
                <GlobeIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              ) : (
                <MapPinIcon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {location.name}
                  <span className="text-muted-foreground ml-2 text-xs font-normal">
                    {LOCATION_KIND_LABELS[location.kind]}
                  </span>
                </p>
                {location.address && <p className="text-muted-foreground [overflow-wrap:anywhere]">{location.address}</p>}
                {location.reminder_minutes > 0 && (
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <BellIcon className="size-3" /> Reminder {location.reminder_minutes} min before
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${location.name}`}
                onClick={() => {
                  setEditing(location);
                  setOpen(true);
                }}
              >
                <PencilIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${location.name}`}
                disabled={remove.isPending}
                onClick={() => void removeLocation(location)}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          <PlusIcon className="size-4" /> Add a location
        </Button>
      </div>
      <LocationDialog open={open} onOpenChange={setOpen} ownerId={ownerId} ownerName={ownerName} existing={editing} />
    </div>
  );
}
