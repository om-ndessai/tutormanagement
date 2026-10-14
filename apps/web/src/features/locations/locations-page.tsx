import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, GlobeIcon, MapPinIcon, PencilIcon, PlusIcon, SearchIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { LOCATION_KIND_LABELS, type Location } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { useUsers } from '@/features/users/api';
import { useDeleteLocation, useOrganizationLocations } from './api';
import { LocationDialog } from './location-dialog';

/**
 * Every tutor's and student's locations in one place (admins only). Each still belongs to its
 * person -- this is the same list as on their records, gathered by owner.
 */
export function LocationsPage() {
  const { data, isLoading } = useOrganizationLocations();
  const tutors = useUsers({ role: 'tutor', limit: 100, sort: 'full_name' });
  const students = useUsers({ role: 'student', limit: 100, sort: 'full_name' });
  const remove = useDeleteLocation();
  const [editing, setEditing] = useState<Location | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const owners = useMemo(() => {
    const seen = new Map<string, string>();
    for (const person of [...(tutors.data?.data ?? []), ...(students.data?.data ?? [])]) {
      seen.set(person.id, person.full_name);
    }
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tutors.data, students.data]);

  const groups = useMemo(() => {
    const byOwner = new Map<string, { id: string; name: string; locations: Location[] }>();
    const needle = search.trim().toLowerCase();
    for (const location of data?.data ?? []) {
      if (needle && !`${location.owner_name} ${location.name}`.toLowerCase().includes(needle)) continue;
      const group = byOwner.get(location.owner_user_id) ?? {
        id: location.owner_user_id,
        name: location.owner_name,
        locations: [],
      };
      group.locations.push(location);
      byOwner.set(location.owner_user_id, group);
    }
    return [...byOwner.values()];
  }, [data, search]);

  async function removeLocation(location: Location) {
    try {
      await remove.mutateAsync(location.id);
      toast.success(`Removed ${location.name}.`);
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? error.message : 'Could not remove the location.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Locations"
        description="Where each tutor and student has lessons. A pairing allows some of its two people’s places, and each schedule picks from those."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <PlusIcon className="size-4" /> Add a location
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          aria-label="Search by person or place"
          placeholder="Search by person or place"
          className="pl-9"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : groups.length === 0 ? (
        <Card className="py-0">
          <CardContent className="text-muted-foreground p-6 text-sm">
            {search.trim()
              ? 'No location matches that search.'
              : 'No locations yet. Add one here, or from a tutor’s or student’s record.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3" data-testid="organization-locations">
          {groups.map((group) => (
            <Card key={group.id} className="py-0">
              <CardContent className="grid gap-3 p-4">
                <Link to={`/users?view=${group.id}`} className="hover:text-primary w-fit font-medium">
                  {group.name}
                </Link>
                <ul className="grid min-w-0 gap-2">
                  {group.locations.map((location) => (
                    <li
                      key={location.id}
                      className="flex min-w-0 items-start gap-3 text-sm"
                      data-testid={`org-location-${location.id}`}
                    >
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
                        {location.address && (
                          <p className="text-muted-foreground [overflow-wrap:anywhere]">{location.address}</p>
                        )}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LocationDialog
        open={open}
        onOpenChange={setOpen}
        ownerId={editing?.owner_user_id ?? ''}
        ownerName={editing?.owner_name ?? ''}
        existing={editing}
        owners={owners}
      />
    </div>
  );
}
