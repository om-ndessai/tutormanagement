import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiList,
  ApiOk,
  BalancesResponse,
  ListPaymentsParams,
  Payment,
  PaymentPayload,
  PaymentUpdatePayload,
} from '@tmi/shared';

import { apiClient, toQueryString } from '@/lib/api-client';
import { auditKeys } from '@/features/audit/api';

interface PaymentListResponse extends ApiList<Payment> {
  total_amount_cents: number;
}

/** Recording money changes balances and the activity log as well as the list. */
function usePaymentInvalidation() {
  const queryClient = useQueryClient();

  return () => {
    void queryClient.invalidateQueries({ queryKey: ['payments'] });
    void queryClient.invalidateQueries({ queryKey: ['balances'] });
    // A payment moves a month's "received" and a tutor's year-end total.
    void queryClient.invalidateQueries({ queryKey: ['finance'] });
    void queryClient.invalidateQueries({ queryKey: auditKeys.all });
  };
}

export function usePayments(params: Partial<ListPaymentsParams> = {}) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () =>
      apiClient.get<PaymentListResponse>(
        `/payments${toQueryString({
          direction: params.direction,
          party_user_id: params.party_user_id,
          student_user_id: params.student_user_id,
          from: params.from,
          to: params.to,
          limit: params.limit,
          offset: params.offset,
        })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useBalances() {
  return useQuery({
    queryKey: ['balances'],
    queryFn: () => apiClient.get<ApiOk<BalancesResponse>>('/payments/balances'),
  });
}

export function useRecordPayment() {
  const invalidate = usePaymentInvalidation();

  return useMutation({
    mutationFn: (input: PaymentPayload) => apiClient.post<ApiOk<Payment>>('/payments', input),
    onSuccess: invalidate,
  });
}

export function useUpdatePayment() {
  const invalidate = usePaymentInvalidation();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PaymentUpdatePayload }) =>
      apiClient.patch<ApiOk<Payment>>(`/payments/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeletePayment() {
  const invalidate = usePaymentInvalidation();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete<undefined>(`/payments/${id}`),
    onSuccess: invalidate,
  });
}
