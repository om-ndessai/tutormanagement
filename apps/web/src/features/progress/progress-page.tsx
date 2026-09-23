import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PROGRESS_STATUS_LABELS, type ProgressStatus } from '@tmi/shared';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/providers/auth-provider';
import { useAssignments } from '@/features/teaching/api';
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

  // One student, or one tutor's students (Phase 21). Kept in the URL so a
  // link or a reload keeps the view. Both narrow the rows the API already
  // scoped to this reader, so a filter can never show more than the list.
  const [params, setParams] = useSearchParams();
  const studentFilter = params.get('student') ?? 'all';
  const tutorFilter = params.get('tutor') ?? 'all';
  const setFilter = (key: 'student' | 'tutor', value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === 'all') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  // Who teaches whom, from the pairings this reader can see.
  const { data: assignmentData } = useAssignments({});
  const tutors = useMemo(() => {
    const byTutor = new Map<string, { name: string; students: Set<string> }>();
    for (const pairing of assignmentData?.data ?? []) {
      const entry = byTutor.get(pairing.tutor_user_id) ?? {
        name: pairing.tutor_name,
        students: new Set<string>(),
      };
      entry.students.add(pairing.student_user_id);
      byTutor.set(pairing.tutor_user_id, entry);
    }
    return [...byTutor.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [assignmentData]);
  const tutorStudents = tutors.find(([id]) => id === tutorFilter)?.[1].students ?? null;

  const students = useMemo(
    () =>
      [...(data?.data ?? [])]
        .map((row) => ({ id: row.student_user_id, name: row.student_name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    const needle = search.trim().toLowerCase();

    return all
      .filter((row) => studentFilter === 'all' || row.student_user_id === studentFilter)
      .filter((row) => tutorFilter === 'all' || (tutorStudents?.has(row.student_user_id) ?? false))
      .filter((row) => status === 'all' || row.summary.status === status)
      .filter((row) => !needle || row.student_name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.summary.status) - STATUS_ORDER.indexOf(b.summary.status) ||
          a.student_name.localeCompare(b.student_name),
      );
  }, [data, search, status, studentFilter, tutorFilter, tutorStudents]);

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
        <Select value={studentFilter} onValueChange={(value) => setFilter('student', value)}>
          <SelectTrigger className="w-full sm:w-48" aria-label="Student">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All students</SelectItem>
            {students.map((student) => (
              <SelectItem key={student.id} value={student.id}>
                {student.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Only worth offering when there is more than one tutor to choose. */}
        {tutors.length > 1 && (
          <Select value={tutorFilter} onValueChange={(value) => setFilter('tutor', value)}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Tutor">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tutors</SelectItem>
              {tutors.map(([id, tutor]) => (
                <SelectItem key={id} value={id}>
                  {tutor.name}’s students
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
                search || status !== 'all' || studentFilter !== 'all' || tutorFilter !== 'all'
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
