import { useState } from 'react';
import { toast } from 'sonner';
import { ArchiveIcon, ArchiveRestoreIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { ORG_PALETTE_LABELS, type OrganizationListItem } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OrgAvatar } from '@/features/organizations/org-avatar';
import { useArchiveOrganization, useOrganizations } from './api';
import { OrganizationDialog } from './organization-dialog';

/** Every organization on the platform, and the way in to creating the next. */
export function OrganizationsPage() {
  const organizations = useOrganizations();
  const archive = useArchiveOrganization();
  const [editing, setEditing] = useState<OrganizationListItem | null>(null);
  const [open, setOpen] = useState(false);

  function openFor(org: OrganizationListItem | null) {
    setEditing(org);
    setOpen(true);
  }

  async function toggleArchived(org: OrganizationListItem) {
    const archived = !org.archived_at;
    await archive.mutateAsync({ id: org.id, archived });
    toast.success(archived ? `${org.name} archived: nobody can enter it.` : `${org.name} restored.`);
  }

  const rows = organizations.data?.data ?? [];
  // Keep the open dialog in step with the list as it refreshes.
  const current = editing ? (rows.find((row) => row.id === editing.id) ?? editing) : null;

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Each one has its own people, records and look. Create one, then add its first admin."
        actions={
          <Button onClick={() => openFor(null)}>
            <PlusIcon />
            New organization
          </Button>
        }
      />

      {organizations.isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="py-0">
          <CardContent className="p-6 text-sm">
            No organizations yet. Create the first, then add its admin -- they take it from there.
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Organizations">
          {rows.map((org) => (
            <li key={org.id}>
              <Card className={org.archived_at ? 'py-0 opacity-70' : 'py-0'}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <OrgAvatar org={org} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{org.name}</span>
                      {org.archived_at && <Badge variant="outline">Archived</Badge>}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {org.slug} · {ORG_PALETTE_LABELS[org.palette]} · {org.admin_count}{' '}
                      {org.admin_count === 1 ? 'admin' : 'admins'} · {org.member_count}{' '}
                      {org.member_count === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => openFor(org)} aria-label={`Edit ${org.name}`}>
                      <PencilIcon />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void toggleArchived(org)}
                      aria-label={org.archived_at ? `Restore ${org.name}` : `Archive ${org.name}`}
                    >
                      {org.archived_at ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <OrganizationDialog open={open} onOpenChange={setOpen} existing={current} />
    </>
  );
}
