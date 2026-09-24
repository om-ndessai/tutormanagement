import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  ListScheduleCancellationsParams,
  ListSchedulesParams,
  ScheduleCancellation,
  ScheduleCancellationInput,
  SchedulePayload,
  ScheduleUpdatePayload,
  ScheduledSession,
  UpcomingSessionsResponse,
  VisibleSchedule,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';
import { progressKeys } from '@/features/progress/api';

function useScheduleInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function useSchedules(params: Partial<ListSchedulesParams> = {}) {
  return useQuery({
    queryKey: ['schedules', params],
    queryFn: () =>
      apiClient.get<ApiOk<VisibleSchedule[]>>(
        `/schedules${toQueryString({
          tutor_user_id: params.tutor_user_id,
          student_user_id: params.student_user_id,
          include_inactive: params.include_inactive,
        })}`,
      ),
  });
}

/**
 * The next dated lessons, five at a time, for the dashboard's carousel. Its
 * key starts with 'schedules', so editing a schedule refreshes it too.
 */
export function useUpcomingSessions(tutorUserId?: string) {
  return useInfiniteQuery({
    queryKey: ['schedules', 'upcoming', tutorUserId ?? null],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      apiClient.get<UpcomingSessionsResponse>(
        `/schedules/upcoming${toQueryString({
          offset: pageParam,
          limit: 5,
          tutor_user_id: tutorUserId,
        })}`,
      ),
    getNextPageParam: (last) =>
      last.meta.has_more ? last.meta.offset + last.meta.limit : undefined,
  });
}

/**
 * One series' coming dates, six at a time, with any that are cancelled
 * flagged -- the Schedule page's list of a slot's dates (Phase 24).
 */
export function useScheduleOccurrences(scheduleId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['schedules', 'upcoming', 'schedule', scheduleId],
    initialPageParam: 0,
    enabled,
    queryFn: ({ pageParam }) =>
      apiClient.get<UpcomingSessionsResponse>(
        `/schedules/upcoming${toQueryString({
          offset: pageParam,
          limit: 6,
          schedule_id: scheduleId,
        })}`,
      ),
    getNextPageParam: (last) =>
      last.meta.has_more ? last.meta.offset + last.meta.limit : undefined,
  });
}

/** Called-off lessons the reader may list, soonest first. */
export function useScheduleCancellations(
  params: Partial<ListScheduleCancellationsParams>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['schedules', 'cancellations', params],
    enabled,
    queryFn: () =>
      apiClient.get<ApiOk<ScheduleCancellation[]>>(
        `/schedules/cancellations${toQueryString({
          from: params.from,
          to: params.to,
          schedule_id: params.schedule_id,
          student_user_id: params.student_user_id,
          tutor_user_id: params.tutor_user_id,
          limit: params.limit,
        })}`,
      ),
  });
}

/**
 * A cancellation moves the schedule's dates, the carousel, the calendar file
 * and the student's progress ("planned so far"), so it refreshes all of them.
 */
function useCancellationInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['schedules'] });
    void queryClient.invalidateQueries({ queryKey: progressKeys.all });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

/** Calls off one lesson of a series. */
export function useCancelLesson() {
  const invalidate = useCancellationInvalidation();

  return useMutation({
    mutationFn: ({ scheduleId, input }: { scheduleId: string; input: ScheduleCancellationInput }) =>
      apiClient.post<ApiOk<ScheduleCancellation>>(`/schedules/${scheduleId}/cancellations`, input),
    onSuccess: invalidate,
  });
}

/** Puts a cancelled lesson back in its series. */
export function useRestoreLesson() {
  const invalidate = useCancellationInvalidation();

  return useMutation({
    mutationFn: ({ scheduleId, occursOn }: { scheduleId: string; occursOn: string }) =>
      apiClient.delete<undefined>(`/schedules/${scheduleId}/cancellations/${occursOn}`),
    onSuccess: invalidate,
  });
}

export function useCreateSchedule() {
  const invalidate = useScheduleInvalidation();

  return useMutation({
    mutationFn: (input: SchedulePayload) =>
      apiClient.post<ApiOk<ScheduledSession>>('/schedules', input),
    onSuccess: invalidate,
  });
}

export function useUpdateSchedule() {
  const invalidate = useScheduleInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ScheduleUpdatePayload }) =>
      apiClient.patch<ApiOk<ScheduledSession>>(`/schedules/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteSchedule() {
  const invalidate = useScheduleInvalidation();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/schedules/${id}`),
    onSuccess: invalidate,
  });
}

/**
 * The calendar endpoints are plain links rather than fetches: the session
 * cookie is sent automatically, and the browser's own download handling gives
 * the file the right name without any blob juggling.
 */
export const calendarHref = {
  all: '/api/schedules/calendar.ics',
  one: (id: string) => `/api/schedules/${id}/calendar.ics`,
};
