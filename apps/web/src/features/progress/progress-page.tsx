import { useMemo, useState } from 'react';
import { PROGRESS_STATUS_LABELS, type ProgressStatus } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { useProgressOverview } from './api';
import { ProgressList } from './progress-list';

/** The order a busy office wants to read them in: trouble first. */
const STATUS_ORDER: ProgressStatus[] = [
  'behind',
  'not_started',
  'no_plan',
  'on_track',
  'ahead',
  'achieved',
  'closed',
];

/**
 * Every student the reader may follow, and where each stands against their
 * plan. An admin sees the institute; a tutor their students; a parent their
 * children; a student themselves.
 */
export function ProgressPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const { data, isPending } = useProgressOverview();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProgressStatus | 'all'>('all');

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    const needle = search.trim().toLowerCase();

    return all
      .filter((row) => status === 'all' || row.summary.status === status)
      .filter((row) => !needle || row.student_name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.summary.status) - STATUS_ORDER.indexOf(b.summary.status) ||
          a.student_name.localeCompare(b.student_name),
      );
  }, [data, search, status]);

  const counts = useMemo(() => {
    const map = new Map<ProgressStatus, number>();
    for (const row of data?.data ?? []) {
      map.set(row.summary.status, (map.get(row.summary.status) ?? 0) + 1);
    }
    return map;
  }, [data]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Progress"
        description={
          isAdmin
            ? 'Every student against their learning plan. Open one to assess them or set a plan.'
            : 'Where each student stands against the plan agreed for them.'
        }
      />

      {/* Filters: one row above what they scope, stacking on a phone. */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a student"
          aria-label="Find a student"
          className="sm:w-56"
        />
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={status === 'all' ? 'default' : 'outline'}
            onClick={() => setStatus('all')}
          >
            All
          </Button>
          {STATUS_ORDER.filter((value) => counts.has(value)).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? 'default' : 'outline'}
              onClick={() => setStatus(value)}
            >
              {PROGRESS_STATUS_LABELS[value]}
              <span className="text-xs opacity-70 tabular-nums">{counts.get(value)}</span>
            </Button>
          ))}
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-4 py-2">
          {isPending ? (
            <div className="space-y-3 py-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <ProgressList
              rows={rows}
              empty={
                search || status !== 'all'
                  ? 'No student matches.'
                  : 'There are no students for you to follow yet.'
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
