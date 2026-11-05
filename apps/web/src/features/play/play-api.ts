import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  boardGrades,
  boardLeadGrade,
  type ApiOk,
  type MemberTilesResponse,
  type OpenGameResponse,
  type QuestGradeInput,
  type QuestMember,
  type WaitingGame,
} from '@tmi/shared';

import { guestLeadLevel } from '@/features/guest/guest-store';
import { apiClient } from '@/lib/api-client';

export const memberTilesKey = ['quest', 'tiles'] as const;

/** Phase 62 (P5/P6): the tiles a member here may start in one tap, and whether the Play home is on. */
export function useMemberTiles(enabled = true) {
  return useQuery({
    queryKey: memberTilesKey,
    queryFn: () => apiClient.get<ApiOk<MemberTilesResponse>>('/quest/tiles'),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Phase 73 (JF14): the grade that leads the board and the Daily -- the server's `lead` (picked on the row, recorded
 * for a student, played last, or the top of the row for 13+). While it is unknown (`ask_grade`) the row's first
 * grade stands in; an older Worker sends no `lead`, and then the old rule applies (the guest's grade, else the first).
 */
export function leadGradeOf(data: MemberTilesResponse | undefined): number | null {
  if (!data) return null;
  if (data.lead) return data.lead.grade;
  if ('lead' in data) return boardGrades(data.tiles)[0] ?? null;
  return boardLeadGrade(data.tiles, guestLeadLevel());
}

/** Phase 73 (JF14): saves the grade picked on the row here (0 is "Not in school"); the board and Daily follow. */
export function useSaveQuestGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: QuestGradeInput) => apiClient.put<ApiOk<{ grade: number | null }>>('/quest/grade', input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: memberTilesKey }),
  });
}

export const openGameKey = ['quest', 'open'] as const;

/**
 * Phase 73 (JF13): Continue -- the reader's open game here (running or in its lobby, with where they are in it), else
 * the last game's settings to start again. Each read costs the Worker a call to the game, so it is read only where
 * Continue shows, at most once a minute and when the tab comes back to the front: never polled. Starting, answering,
 * leaving, ending and the results mark it stale.
 */
export function useOpenGame(enabled = true) {
  return useQuery({
    queryKey: openGameKey,
    queryFn: () => apiClient.get<ApiOk<OpenGameResponse>>('/quest/games/open'),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Phase 62 (P8): games a roster invited the reader to. Read when the tab is in front, at most once a
 * minute -- never polled in the background (the free plan's request count).
 */
export function useWaitingGames(enabled = true) {
  return useQuery({
    queryKey: ['quest', 'waiting'] as const,
    queryFn: () => apiClient.get<ApiOk<WaitingGame[]>>('/quest/games/waiting'),
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

/** Phase 62 (P8, R27): who the reader may put on a roster. */
export function useRosterMembers(enabled = true) {
  return useQuery({
    queryKey: ['quest', 'members'] as const,
    queryFn: () => apiClient.get<ApiOk<QuestMember[]>>('/quest/games/members'),
    enabled,
    staleTime: 60_000,
  });
}
