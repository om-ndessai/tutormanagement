import { Loader2Icon } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUserDetail } from './api';
import { UserDetailView } from './user-detail-view';

/** Read-only view of everything the portal holds about one person. */
export function UserDetailDialog({
  userId,
  onOpenChange,
}: {
  userId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isPending, isError } = useUserDetail(userId);

  return (
    <Dialog open={userId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>User details</DialogTitle>
          <DialogDescription>Everything on file for this person.</DialogDescription>
        </DialogHeader>

        {isPending && userId && (
          <p className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            Loading…
          </p>
        )}

        {isError && <p className="text-destructive py-10 text-sm">Could not load that record.</p>}

        {data && <UserDetailView user={data.data} />}
      </DialogContent>
    </Dialog>
  );
}
