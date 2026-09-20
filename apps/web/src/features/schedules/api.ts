import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  ListSchedulesParams,
  SchedulePayload,
  ScheduleUpdatePayload,
  ScheduledSession,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';

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
      apiClient.get<ApiOk<ScheduledSession[]>>(
        `/schedules${toQueryString({
          tutor_user_id: params.tutor_user_id,
          student_user_id: params.student_user_id,
          include_inactive: params.include_inactive,
        })}`,
      ),
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
