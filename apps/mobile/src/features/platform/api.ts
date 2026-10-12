// Ported from apps/web/src/features/platform/api.ts @ 1132322
// Mobile: the logo upload takes the picked image's bytes (apiClient.putBytes) instead of a DOM File.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AddOrganizationAdminInput,
  ApiOk,
  CreateOrganizationInput,
  LogoContentType,
  LogoKind,
  Organization,
  OrganizationAdmin,
  OrganizationListItem,
  PlatformAdmin,
  PlatformPerson,
  PlatformPersonUpdateInput,
  UpdateOrganizationInput,
} from '@tmi/shared';

import { apiClient } from '@/lib/api-client';

export const platformKeys = {
  organizations: ['platform', 'organizations'] as const,
  admins: (id: string) => ['platform', 'organizations', id, 'admins'] as const,
  platformAdmins: ['platform', 'admins'] as const,
  audit: ['platform', 'audit'] as const,
};

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
    mutationFn: ({
      id,
      kind,
      bytes,
      contentType,
    }: {
      id: string;
      kind: LogoKind;
      bytes: ArrayBuffer;
      contentType: LogoContentType;
    }) =>
      apiClient.putBytes<ApiOk<Organization>>(
        `/platform/organizations/${id}/logo/${kind}`,
        bytes,
        contentType,
      ),
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
