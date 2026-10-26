import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon } from 'lucide-react';
import type { BusinessListItem } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiRequestError } from '@/lib/api-client';
import { useArchiveBusiness, useBusinesses, useCreateBusiness, useUpdateBusiness } from './api';
import { FormField } from './form-field';

const FIELDS = [
  ['name', 'Name'],
  ['tin', 'TIN (EIN)'],
  ['payer_address_line1', 'Address'],
  ['payer_address_line2', 'Address line 2'],
  ['payer_city', 'City'],
  ['payer_state', 'State'],
  ['payer_postal_code', 'ZIP'],
] as const;
type Key = (typeof FIELDS)[number][0];
type Form = Record<Key, string>;
const EMPTY: Form = Object.fromEntries(FIELDS.map(([key]) => [key, ''])) as Form;

/**
 * Phase 54: organizations in the money sense -- who families pay and who files
 * the 1099s (`businesses` in the code). One may run several spaces; a space
 * with none is paid directly. Linking one to a space is on the space.
 */
export function BusinessesPage() {
  const businesses = useBusinesses();
  const archive = useArchiveBusiness();
  const [editing, setEditing] = useState<BusinessListItem | null>(null);
  const [open, setOpen] = useState(false);
  const rows = businesses.data?.data ?? [];

  async function toggleArchived(row: BusinessListItem) {
    try {
      await archive.mutateAsync({ id: row.id, archived: !row.archived_at });
      toast.success(row.archived_at ? `${row.name} restored.` : `${row.name} archived.`);
    } catch (caught) {
      toast.error(caught instanceof ApiRequestError ? caught.message : 'Could not change it.');
    }
  }

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Who families pay, and who files the 1099s: a name, a TIN and a payer address. One may run several spaces; a space with none is paid directly, each family paying its tutor."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <PlusIcon />
            New organization
          </Button>
        }
      />

      {businesses.isPending ? (
        <Skeleton className="h-20" />
      ) : rows.length === 0 ? (
        <Card className="py-0">
          <CardContent className="p-6 text-sm">No organizations yet. Every space is paid directly.</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Organizations">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className={row.archived_at ? 'py-0 opacity-70' : 'py-0'}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{row.name}</span>
                      {row.archived_at && <Badge variant="outline">Archived</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {row.tin ? 'TIN on file' : 'No TIN yet'} ·{' '}
                      {row.spaces.length === 0
                        ? 'runs no space'
                        : `runs ${row.spaces.map((space) => space.name).join(', ')}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit ${row.name}`}
                      onClick={() => {
                        setEditing(row);
                        setOpen(true);
                      }}
                    >
                      <PencilIcon />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={row.archived_at ? `Restore ${row.name}` : `Archive ${row.name}`}
                      onClick={() => void toggleArchived(row)}
                    >
                      {row.archived_at ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <BusinessDialog open={open} onOpenChange={setOpen} existing={editing} />
    </>
  );
}

function BusinessDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: BusinessListItem | null;
}) {
  const create = useCreateBusiness();
  const update = useUpdateBusiness();
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      existing
        ? (Object.fromEntries(FIELDS.map(([key]) => [key, existing[key] ?? ''])) as Form)
        : EMPTY,
    );
  }, [open, existing]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    try {
      if (existing) await update.mutateAsync({ id: existing.id, input: form });
      else await create.mutateAsync(form);
      toast.success(`${form.name} saved.`);
      onOpenChange(false);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setErrors(caught.fieldErrors);
        toast.error(caught.message);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? existing.name : 'New organization'}</DialogTitle>
            <DialogDescription>
              The payer box on every 1099 it files. The TIN is the organization’s EIN — never a
              Social Security number, which the portal refuses to store.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            {FIELDS.map(([key, label]) => (
              <div key={key} className={key === 'name' || key === 'tin' ? 'sm:col-span-2' : undefined}>
                <FormField id={`business-${key}`} label={label} error={errors[key]} optional={key !== 'name'}>
                  <Input
                    id={`business-${key}`}
                    value={form[key]}
                    aria-invalid={Boolean(errors[key])}
                    onChange={(event) => setForm((previous) => ({ ...previous, [key]: event.target.value }))}
                  />
                </FormField>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
