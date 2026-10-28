import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiOk,
  HandwritingReadResult,
  HandwritingSample,
  HandwritingSampleList,
  ReadHandwritingInput,
  SaveHandwritingSampleInput,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

// The Handwriting lab of the platform console (Phase 54: AI-13 stage 0).

export const handwritingKeys = {
  samples: ['platform', 'handwriting', 'samples'] as const,
};

/** Reads up to HANDWRITING_LIMITS.linesPerRequest lines, each on its own, blind. */
export function readHandwriting(input: ReadHandwritingInput): Promise<HandwritingReadResult> {
  return apiClient.post<ApiOk<HandwritingReadResult>>('/platform/handwriting/read', input).then((r) => r.data);
}

export function useHandwritingSamples() {
  return useQuery({
    queryKey: handwritingKeys.samples,
    queryFn: () => apiClient.get<ApiOk<HandwritingSampleList>>('/platform/handwriting/samples?limit=50'),
  });
}

export function useSaveHandwritingSample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveHandwritingSampleInput) =>
      apiClient.post<ApiOk<HandwritingSample>>('/platform/handwriting/samples', input).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: handwritingKeys.samples }),
  });
}

export function useDeleteHandwritingSample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<ApiOk<{ id: string }>>(`/platform/handwriting/samples/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: handwritingKeys.samples }),
  });
}

/** The corpus as a file: a plain link, so the browser names it and the cookie goes along. */
export function corpusUrl(source: 'samples' | 'synthetic'): string {
  return `/api/platform/handwriting/corpus?source=${source}`;
}
