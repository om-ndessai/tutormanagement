import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AccessConsoleResponse,
  AccessDecision,
  AccessListEntryInput,
  AccessSettings,
  AddOrganizationAdminInput,
  ApiOk,
  CreateOrganizationInput,
  OrganizationFeaturesInput,
  LogoKind,
  Organization,
  OrganizationAdmin,
  OrganizationListItem,
  PlatformAdmin,
  PlatformPerson,
  PlatformPersonUpdateInput,
  PlacementSpace,
  SignInSettingsResponse,
  PlayConsoleResponse,
  GuestConsoleResponse,
  GuestPoolConsoleResponse,
  GuestSettings,
  UpdatePlayInput,
  UpdateSignInSetting,
  SpacePaymentModel,
  UpdateOrganizationInput,
  StickinessReport,
  VisitSettings,
  VisitSettingsResponse,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

export const platformKeys = {
  organizations: ['platform', 'organizations'] as const,
  admins: (id: string) => ['platform', 'organizations', id, 'admins'] as const,
  platformAdmins: ['platform', 'admins'] as const,
  audit: ['platform', 'audit'] as const,
};

/**
 * Phase 59: who families pay in a space from now on -- the space (its own payer record) or each
 * tutor directly. Replaces choosing a business; the payer details travel on the space's PATCH.
 */
export function useSetPaymentModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, model }: { id: string; model: SpacePaymentModel }) =>
      apiClient.put<ApiOk<Organization>>(`/platform/organizations/${id}/payment-model`, { model }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: platformKeys.organizations,
    queryFn: () => apiClient.get<ApiOk<OrganizationListItem[]>>('/platform/organizations'),
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) =>
      apiClient.post<ApiOk<Organization>>('/platform/organizations', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOrganizationInput }) =>
      apiClient.patch<ApiOk<Organization>>(`/platform/organizations/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

/** Phase 50: which feature sets an organization is allowed. */
export function useUpdateOrganizationFeatures() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: OrganizationFeaturesInput }) =>
      apiClient.put<ApiOk<Organization>>(`/platform/organizations/${id}/features`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

export function useArchiveOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      apiClient.post<ApiOk<Organization>>(
        `/platform/organizations/${id}/${archived ? 'archive' : 'restore'}`,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind, file }: { id: string; kind: LogoKind; file: File }) =>
      apiClient.putFile<ApiOk<Organization>>(`/platform/organizations/${id}/logo/${kind}`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

export function useRemoveLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: LogoKind }) =>
      apiClient.delete<ApiOk<Organization>>(`/platform/organizations/${id}/logo/${kind}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformKeys.organizations }),
  });
}

export function useOrganizationAdmins(id: string | null) {
  return useQuery({
    queryKey: platformKeys.admins(id ?? ''),
    queryFn: () => apiClient.get<ApiOk<OrganizationAdmin[]>>(`/platform/organizations/${id}/admins`),
    enabled: id !== null,
  });
}

export function useAddOrganizationAdmin(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddOrganizationAdminInput) =>
      apiClient.post<ApiOk<OrganizationAdmin[]>>(`/platform/organizations/${id}/admins`, input),
    onSuccess: (response) => {
      queryClient.setQueryData(platformKeys.admins(id), response);
      void queryClient.invalidateQueries({ queryKey: platformKeys.organizations });
    },
  });
}

export function useRemoveOrganizationAdmin(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      apiClient.delete<ApiOk<OrganizationAdmin[]>>(`/platform/organizations/${id}/admins/${userId}`),
    onSuccess: (response) => {
      queryClient.setQueryData(platformKeys.admins(id), response);
      void queryClient.invalidateQueries({ queryKey: platformKeys.organizations });
    },
  });
}

export function usePlatformAdmins() {
  return useQuery({
    queryKey: platformKeys.platformAdmins,
    queryFn: () => apiClient.get<ApiOk<PlatformAdmin[]>>('/platform/admins'),
  });
}

export function useAddPlatformAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddOrganizationAdminInput) =>
      apiClient.post<ApiOk<PlatformAdmin[]>>('/platform/admins', input),
    onSuccess: (response) => queryClient.setQueryData(platformKeys.platformAdmins, response),
  });
}

export function useLookupPerson() {
  return useMutation({
    mutationFn: (email: string) =>
      apiClient.get<ApiOk<PlatformPerson>>(`/platform/people?email=${encodeURIComponent(email)}`),
  });
}

export function useUpdatePerson() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PlatformPersonUpdateInput }) =>
      apiClient.patch<ApiOk<PlatformPerson>>(`/platform/people/${id}`, input),
  });
}

export function useUnpinPerson() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/platform/people/${id}/unpin`),
  });
}

export interface PlatformAuditRow {
  id: string;
  organization_id: string | null;
  organization_name: string | null;
  actor_name: string;
  subject_name: string | null;
  action: string;
  description: string;
  created_at: string;
}

export function usePlatformAudit() {
  return useQuery({
    queryKey: platformKeys.audit,
    queryFn: () => apiClient.get<ApiOk<PlatformAuditRow[]>>('/platform/audit'),
  });
}

/**
 * Phase 62 (P0): the sign-in switches -- which ways in, and whether newcomers may sign up, for the web
 * portal and the app separately, for a while or until changed.
 */
export const signInSettingsKey = ['platform', 'sign-in'] as const;

export function useSignInSettings() {
  return useQuery({
    queryKey: signInSettingsKey,
    queryFn: () => apiClient.get<ApiOk<SignInSettingsResponse>>('/platform/sign-in'),
  });
}

export function useUpdateSignInSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSignInSetting) =>
      apiClient.put<ApiOk<SignInSettingsResponse>>('/platform/sign-in', input),
    onSuccess: (result) => queryClient.setQueryData(signInSettingsKey, result),
  });
}

/** Phase 62 (P5): the tiles and the Play settings. */
export const playKey = ['platform', 'play'] as const;

export function usePlayConsole() {
  return useQuery({ queryKey: playKey, queryFn: () => apiClient.get<ApiOk<PlayConsoleResponse>>('/platform/play') });
}

export function useSavePlay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePlayInput) => apiClient.put<ApiOk<PlayConsoleResponse>>('/platform/play', input),
    onSuccess: (result) => queryClient.setQueryData(playKey, result),
  });
}

export function useResetTiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<ApiOk<PlayConsoleResponse>>('/platform/play/reset-tiles'),
    onSuccess: (result) => queryClient.setQueryData(playKey, result),
  });
}

/** Phase 63 (P16): guest play's settings and pools. */
export const guestKey = ['platform', 'guest'] as const;

export function useGuestConsole() {
  return useQuery({ queryKey: guestKey, queryFn: () => apiClient.get<ApiOk<GuestConsoleResponse>>('/platform/guest') });
}

export function useSaveGuestSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: GuestSettings) => apiClient.put<ApiOk<GuestConsoleResponse>>('/platform/guest', settings),
    onSuccess: (result) => queryClient.setQueryData(guestKey, result),
  });
}

export function useGuestPoolConsole(level: string | null) {
  return useQuery({
    queryKey: ['platform', 'guest', 'pool', level] as const,
    queryFn: () => apiClient.get<ApiOk<GuestPoolConsoleResponse>>(`/platform/guest/pools/${encodeURIComponent(level!)}`),
    enabled: level !== null,
  });
}

export function useSaveGuestPool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { level_id: string; question_ids: string[] }) =>
      apiClient.put<ApiOk<GuestPoolConsoleResponse>>(`/platform/guest/pools/${encodeURIComponent(input.level_id)}`, input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: guestKey }),
  });
}

/** Phase 65: sign-up access -- the mode, the platform's list, and the decisions on sign-ups. */
export const accessKey = ['platform', 'access'] as const;

export function useAccessConsole() {
  return useQuery({ queryKey: accessKey, queryFn: () => apiClient.get<ApiOk<AccessConsoleResponse>>('/platform/access') });
}

function useAccessMutation<I>(call: (input: I) => Promise<ApiOk<AccessConsoleResponse>>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: call, onSuccess: (result) => queryClient.setQueryData(accessKey, result) });
}

export function useSaveAccessMode() {
  return useAccessMutation((settings: AccessSettings) => apiClient.put<ApiOk<AccessConsoleResponse>>('/platform/access', settings));
}

export function useAddAccessEntry() {
  return useAccessMutation((entry: AccessListEntryInput) => apiClient.post<ApiOk<AccessConsoleResponse>>('/platform/access/list', entry));
}

export function useRemoveAccessEntry() {
  return useAccessMutation((id: string) => apiClient.delete<ApiOk<AccessConsoleResponse>>(`/platform/access/list/${encodeURIComponent(id)}`));
}

/**
 * Approves or declines a sign-up. Phase 80 (A11): approving may place them in a space (`space`); without it, their
 * own space is made, as before.
 */
export function useDecideAccess() {
  return useAccessMutation(({ userId, ...decision }: { userId: string } & AccessDecision) =>
    apiClient.put<ApiOk<AccessConsoleResponse>>(`/platform/access/accounts/${encodeURIComponent(userId)}`, decision),
  );
}

/**
 * Phase 80 (A11): the spaces the approve sheet may place someone in -- live, not personal, by name. A read across
 * spaces, so it is fetched only while the sheet is open.
 */
export function usePlacementSpaces(enabled: boolean) {
  return useQuery({
    queryKey: ['platform', 'placement-spaces'] as const,
    queryFn: () => apiClient.get<ApiOk<PlacementSpace[]>>('/platform/access/spaces'),
    enabled,
  });
}

/** Phase 69 (H12): visit recording, and the Stickiness figures (totals only). */
export const stickinessKeys = {
  visits: ['platform', 'visits'] as const,
  report: ['platform', 'stickiness'] as const,
};

export function useVisitSettings() {
  return useQuery({ queryKey: stickinessKeys.visits, queryFn: () => apiClient.get<ApiOk<VisitSettingsResponse>>('/platform/visits') });
}

export function useSaveVisitSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: VisitSettings) => apiClient.put<ApiOk<VisitSettingsResponse>>('/platform/visits', settings),
    onSuccess: (answer) => client.setQueryData(stickinessKeys.visits, answer),
  });
}

export function useStickiness() {
  return useQuery({ queryKey: stickinessKeys.report, queryFn: () => apiClient.get<ApiOk<StickinessReport | null>>('/platform/stickiness') });
}

export function useRefreshStickiness() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<ApiOk<StickinessReport>>('/platform/stickiness/refresh'),
    onSuccess: (answer) => client.setQueryData(stickinessKeys.report, answer),
  });
}
