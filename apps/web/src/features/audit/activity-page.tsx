import { useMemo, useState } from 'react';
import { AUDIT_ACTION_LABELS, auditEntity } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUsers } from '@/features/users/api';
import { useAuth } from '@/providers/auth-provider';
import { useAuditActions, useAuditEvents } from './api';
import { ActivityFeed } from './activity-feed';

const PAGE_SIZE = 50;
const ANY = 'any';

/**
 * "Admin should have ability to see the user activity within the entire system
 * as well as for individual user." Both live here: the person filter narrows
 * the same feed.
 */
export function ActivityPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;

  const [userId, setUserId] = useState<string>(ANY);
  const [action, setAction] = useState<string>(ANY);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const params = useMemo(
    () => ({
      user_id: userId === ANY ? undefined : userId,
      action: action === ANY ? undefined : action,
      from: from || undefined,
      to: to || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [userId, action, from, to, page],
  );

  const { data, isPending } = useAuditEvents(params);
  const { data: actionsData } = useAuditActions();
  // Only admins can list everybody, so the person filter is admin-only anyway.
  const { data: usersData } = useUsers({ limit: 100, sort: 'full_name' });

  const events = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  function reset<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(0);
    };
  }

  const hasFilters = userId !== ANY || action !== ANY || from !== '' || to !== '';

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Activity"
        description={
          isAdmin
            ? 'Everything that has happened in the portal, newest first.'
            : 'Your activity in the portal, newest first.'
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {isAdmin && (
          <div className="grid gap-1.5">
            <Label htmlFor="who" className="text-muted-foreground text-xs">
              Person
            </Label>
            <Select value={userId} onValueChange={reset(setUserId)}>
              <SelectTrigger id="who" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Everyone</SelectItem>
                {(usersData?.data ?? []).map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="what" className="text-muted-foreground text-xs">
            Action
          </Label>
          <Select value={action} onValueChange={reset(setAction)}>
            <SelectTrigger id="what" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All actions</SelectItem>
              {(actionsData?.data ?? []).map((value) => (
                <SelectItem key={value} value={value}>
                  {AUDIT_ACTION_LABELS[value as never] ?? value}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {auditEntity(value)}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="from" className="text-muted-foreground text-xs">
            From
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(event) => reset(setFrom)(event.target.value)}
            className="w-40"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="to" className="text-muted-foreground text-xs">
            To
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(event) => reset(setTo)(event.target.value)}
            className="w-40"
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setUserId(ANY);
              setAction(ANY);
              setFrom('');
              setTo('');
              setPage(0);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <Card>
        <CardContent>
          <ActivityFeed
            events={events}
            isLoading={isPending}
            emptyMessage={
              hasFilters ? 'No activity matches these filters.' : 'No activity recorded yet.'
            }
          />
        </CardContent>
      </Card>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {total === 0
            ? 'No events'
            : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
