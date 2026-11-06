import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarDaysIcon,
  CalendarPlusIcon,
  DownloadIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  COMMON_COPY,
  describeLocation,
  DAYS_OF_WEEK,
  SESSION_MODE_LABELS,
  describeSchedule,
  type ScheduledSession,
} from '@tmi/shared';

import { FocusNotice } from '@/components/layout/focus-notice';
import { PageHeader } from '@/components/layout/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentsButton } from '@/features/comments/comments-button';
import { ApiRequestError } from '@/lib/api-client';
import { useDates } from '@/hooks/use-dates';
import { useAuth } from '@/providers/auth-provider';
import { NoPriceBadge } from '@/features/teaching/price-missing';
import { ScheduleDates } from './schedule-dates';
import { ScheduleDialog } from './schedule-dialog';
import { calendarHref, useDeleteSchedule, useSchedules } from './api';

/**
 * Standing weekly lessons, grouped by weekday so the week reads top to bottom.
 * Everyone who can see a schedule can download it; only its tutor (or an
 * admin) can change it.
 */
export function SchedulesPage() {
  const { user } = useAuth();
  const dates = useDates();
  const isAdmin = user?.roles.includes('admin') ?? false;
  const isTutor = user?.roles.includes('tutor') ?? false;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledSession | null>(null);
  const [removing, setRemoving] = useState<ScheduledSession | null>(null);
  const [showingDates, setShowingDates] = useState(new Set<string>());
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isPending } = useSchedules();
  const remove = useDeleteSchedule();

  /** One slot, when a comment in the feed links straight to it. */
  const focusId = searchParams.get('focus');
  // A link from the dashboard's carousel names one date of the series too.
  const focusDate = searchParams.get('on');
  const all = data?.data ?? [];
  const schedules = focusId ? all.filter((row) => row.id === focusId) : all;
  const clearFocus = () =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete('focus');
        next.delete('on');
        return next;
      },
      { replace: true },
    );

  const byDay = DAYS_OF_WEEK.map((day) => ({
    day,
    items: schedules.filter((schedule) => schedule.day_of_week === day.value),
  })).filter((group) => group.items.length > 0);

  async function confirmRemove() {
    if (!removing) return;

    try {
      await remove.mutateAsync(removing.id);
      toast.success('Schedule removed.');
    } catch (error) {
      toast.error(
        error instanceof ApiRequestError ? error.message : 'Could not remove the schedule.',
      );
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Schedule"
        description="Standing weekly lessons. Add them to your calendar in one click."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {schedules.length > 0 && (
              <Button variant="outline" asChild>
                {/* A plain link: the cookie goes along and the browser names
                    the file from Content-Disposition. */}
                <a href={calendarHref.all()} download>
                  <DownloadIcon />
                  Add all to calendar
                </a>
              </Button>
            )}
            {(isTutor || isAdmin) && (
              <Button
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                <CalendarPlusIcon />
                {COMMON_COPY.schedule_lesson}
              </Button>
            )}
          </div>
        }
      />

      <FocusNotice
        active={Boolean(focusId)}
        found={schedules.length > 0}
        what="scheduled lesson"
        onClear={clearFocus}
      />

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isPending && schedules.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {isTutor || isAdmin
                ? 'No recurring lessons scheduled yet.'
                : 'No recurring lessons have been scheduled for you.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {byDay.map(({ day, items }) => (
          <section key={day.value}>
            <h2 className="text-muted-foreground mb-2 text-sm font-semibold">
              {day.label}
            </h2>

            <ul className="space-y-2">
              {items.map((schedule) => {
                const canEdit = isAdmin || schedule.tutor_user_id === user?.id;
                // Its dates open by themselves when a link points at this slot.
                const datesOpen = showingDates.has(schedule.id) || schedule.id === focusId;
                const toggleDates = () =>
                  setShowingDates((current) => {
                    const next = new Set(current);
                    if (datesOpen) next.delete(schedule.id);
                    else next.add(schedule.id);
                    return next;
                  });

                return (
                  <li key={schedule.id}>
                    <Card>
                      {/* Below sm the row stacks (Phase 78, JF28): the lesson first, its actions on a line of their own. */}
                      <CardContent className="grid gap-3 py-4 sm:flex sm:flex-wrap sm:items-center">
                        <div className="min-w-0 sm:flex-1">
                          <p className="font-medium break-words">
                            {schedule.student_name}
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              with {schedule.tutor_name}
                            </span>
                          </p>
                          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span>{describeSchedule(schedule)}</span>
                            <Badge variant="secondary" className="text-xs">
                              {SESSION_MODE_LABELS[schedule.mode]}
                            </Badge>
                            {/* Phase 75 (JF18): its lessons could not be priced -- said before Start refuses. */}
                            <NoPriceBadge missing={schedule.price_missing} mode={schedule.mode} testId={`no-price-${schedule.id}`} />
                            <span>{dates.span(schedule.starts_on, schedule.ends_on)}</span>
                          </p>
                          {schedule.locations.length > 0 && (
                            <p className="text-muted-foreground mt-1 text-xs break-words" data-testid="schedule-locations">
                              {schedule.locations.map((location) => describeLocation(location)).join(' · ')}
                            </p>
                          )}
                          {schedule.location && (
                            <p className="text-muted-foreground mt-1 text-xs break-words">
                              {schedule.location}
                            </p>
                          )}
                        </div>

                        <div className="-ml-2 flex flex-wrap items-center gap-1 sm:ml-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-expanded={datesOpen}
                            onClick={toggleDates}
                          >
                            <CalendarDaysIcon />
                            Dates
                          </Button>

                          <CommentsButton
                            target={{ target_type: 'scheduled_session', target_id: schedule.id }}
                            title={`${schedule.student_name}’s recurring lesson`}
                            description={`${describeSchedule(schedule)}, with ${schedule.tutor_name}.`}
                          />

                          <Button variant="ghost" size="icon" aria-label="Download calendar invite" asChild>
                            <a href={calendarHref.one(schedule.id)} download>
                              <DownloadIcon />
                            </a>
                          </Button>

                          {canEdit && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit schedule"
                                onClick={() => {
                                  setEditing(schedule);
                                  setDialogOpen(true);
                                }}
                              >
                                <PencilIcon />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Remove schedule"
                                onClick={() => setRemoving(schedule)}
                              >
                                <Trash2Icon />
                              </Button>
                            </>
                          )}
                        </div>

                        {datesOpen && (
                          <div className="basis-full">
                            <ScheduleDates
                              schedule={schedule}
                              highlight={schedule.id === focusId ? focusDate : null}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <ScheduleDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this recurring lesson?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.student_name}&apos;s {removing && describeSchedule(removing)} slot will no
              longer appear, and any of its lessons that were cancelled go with it — so they stop
              counting as cancelled in the student&apos;s progress. Lessons already taught are
              unaffected. To stop a series but keep its record, give it an end date instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={remove.isPending}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
