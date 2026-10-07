/**
 * @file services/api/adminApi.ts
 * @description Platform Admin endpoints for users and audit logs.
 * Approvals keep using services/adminService.ts, which already matches the backend.
 */
import { apiClient } from '../apiClient';
import type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserSearchParams,
  ApiEnvelope,
  AuditLogDetail,
  AuditLogItem,
  AuditLogSearchParams,
  AdminServiceType,
  CommissionMilestone,
  CommissionRule,
  CommissionRuleCreateInput,
  CommissionRuleUpdateInput,
  Paged,
  ServiceTypeAllowedRole,
  ServiceTypeInput,
} from '@/types/api/admin';

const cleanParams = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>;

export const adminUsersApi = {
  /** GET /admin/users — requires user.view. */
  async list(params: AdminUserSearchParams): Promise<Paged<AdminUserListItem>> {
    const res = await apiClient.get<ApiEnvelope<Paged<AdminUserListItem>>>('/admin/users', {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  /** GET /admin/users/{id} */
  async get(userId: string): Promise<AdminUserDetail> {
    const res = await apiClient.get<ApiEnvelope<AdminUserDetail>>(`/admin/users/${userId}`);
    return res.data.data;
  },

  /** PATCH /admin/users/{id}/status — ACTIVE or SUSPENDED; reason required for SUSPENDED. */
  async changeStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string) {
    const res = await apiClient.patch<ApiEnvelope<AdminUserDetail>>(`/admin/users/${userId}/status`, {
      status,
      reason: reason || null,
    });
    return res.data;
  },

  /** POST /admin/users/{id}/unlock — clears the failed-login lockout. */
  async unlock(userId: string) {
    const res = await apiClient.post<ApiEnvelope<AdminUserDetail>>(`/admin/users/${userId}/unlock`);
    return res.data;
  },
};

export const adminAuditApi = {
  /** GET /admin/audit-logs — requires audit.view. */
  async list(params: AuditLogSearchParams): Promise<Paged<AuditLogItem>> {
    const res = await apiClient.get<ApiEnvelope<Paged<AuditLogItem>>>('/admin/audit-logs', {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  /** GET /admin/audit-logs/{id} — includes old/new values. */
  async get(auditLogId: number): Promise<AuditLogDetail> {
    const res = await apiClient.get<ApiEnvelope<AuditLogDetail>>(`/admin/audit-logs/${auditLogId}`);
    return res.data.data;
  },
};

export const adminServiceTypesApi = {
  /** GET /service-types without isActive → active and inactive types. */
  async list(): Promise<AdminServiceType[]> {
    const res = await apiClient.get<ApiEnvelope<{ items: AdminServiceType[] }>>('/service-types', {
      params: { pageSize: 100, sortBy: 'name', sortDirection: 'asc' },
    });
    return res.data.data.items;
  },
  async create(input: ServiceTypeInput) {
    return (await apiClient.post<ApiEnvelope<AdminServiceType>>('/admin/service-types', input)).data;
  },
  async update(id: string, input: ServiceTypeInput) {
    return (await apiClient.put<ApiEnvelope<AdminServiceType>>(`/admin/service-types/${id}`, input)).data;
  },
  /** DELETE — when the type is already used the backend deactivates it instead (isDeactivated). */
  async remove(id: string) {
    return (
      await apiClient.delete<{ success: boolean; message: string; isDeactivated: boolean }>(`/admin/service-types/${id}`)
    ).data;
  },
  async getAllowedRoles(id: string): Promise<ServiceTypeAllowedRole[]> {
    const res = await apiClient.get<ApiEnvelope<{ roles: ServiceTypeAllowedRole[] }>>(
      `/admin/service-types/${id}/allowed-roles`
    );
    return res.data.data.roles;
  },
  async replaceAllowedRoles(id: string, roles: { roleId: string; canView: boolean; canSubmit: boolean }[]) {
    return (await apiClient.put<ApiEnvelope<unknown>>(`/admin/service-types/${id}/allowed-roles`, { roles })).data;
  },
};

export const adminCommissionApi = {
  async list(params: { serviceTypeId?: string; isActive?: boolean; page: number; pageSize: number }): Promise<Paged<CommissionRule>> {
    const res = await apiClient.get<ApiEnvelope<Paged<CommissionRule>>>('/admin/commission-rules', {
      params: cleanParams(params),
    });
    return res.data.data;
  },
  async milestones(): Promise<CommissionMilestone[]> {
    const res = await apiClient.get<ApiEnvelope<CommissionMilestone[]>>('/admin/commission-milestones', {
      params: { isActive: true },
    });
    return res.data.data;
  },
  async create(input: CommissionRuleCreateInput) {
    return (await apiClient.post<ApiEnvelope<CommissionRule>>('/admin/commission-rules', input)).data;
  },
  async update(id: string, input: CommissionRuleUpdateInput) {
    return (await apiClient.put<ApiEnvelope<CommissionRule>>(`/admin/commission-rules/${id}`, input)).data;
  },
  async setActive(id: string, active: boolean) {
    return (
      await apiClient.patch<ApiEnvelope<unknown>>(`/admin/commission-rules/${id}/${active ? 'activate' : 'deactivate'}`)
    ).data;
  },
};
