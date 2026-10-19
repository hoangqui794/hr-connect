/**
 * @file services/api/rbacApi.ts
 * @description Centralized RBAC API client for Platform Admin authorization management.
 * Base URL: /api/v1/admin/authorization (relative to apiClient: /admin/authorization).
 * Covers all 12 endpoints specified in FRONTEND-INTEGRATION.md.
 */

import axios from 'axios';
import { apiClient } from '../apiClient';
import type { ApiEnvelope, Paged } from '@/types/api/admin';
import type { ApiErrorPayload } from '@/types/api/common';
import {
  isDelegablePermission,
  normalizeRoleCode,
  RBAC_ERROR_CODES,
  type RbacAssignUserRoleInput,
  type RbacCreateRoleInput,
  type RbacDeleteRoleInput,
  type RbacPermission,
  type RbacPermissionSearchParams,
  type RbacReplaceRolePermissionsInput,
  type RbacRevokeUserRoleInput,
  type RbacRole,
  type RbacRoleSearchParams,
  type RbacUpdatePermissionInput,
  type RbacUpdateRoleInput,
  type RbacUserAuthorization,
} from '@/types/api/rbac';

const cleanParams = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ) as Partial<T>;

const BASE_PATH = '/admin/authorization';

/**
 * Checks if an error is an RBAC concurrency conflict (HTTP 409 + RBAC_CONCURRENCY_CONFLICT).
 */
export const isRbacConflict = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    return (
      error.response?.status === 409 &&
      (data?.errorCode === RBAC_ERROR_CODES.RBAC_CONCURRENCY_CONFLICT ||
        data?.code === RBAC_ERROR_CODES.RBAC_CONCURRENCY_CONFLICT)
    );
  }
  return false;
};

/**
 * Checks if an error is a self-role mutation forbidden error (HTTP 403 + SELF_ROLE_MUTATION_FORBIDDEN).
 */
export const isSelfRoleMutationForbidden = (error: unknown): boolean => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorPayload | undefined;
    return (
      error.response?.status === 403 &&
      (data?.errorCode === RBAC_ERROR_CODES.SELF_ROLE_MUTATION_FORBIDDEN ||
        data?.code === RBAC_ERROR_CODES.SELF_ROLE_MUTATION_FORBIDDEN)
    );
  }
  return false;
};

export const rbacApi = {
  // ── 1. Permissions ──────────────────────────────────────────────────────────

  /**
   * 1. GET /permissions
   * List permissions with pagination and filters.
   */
  async getPermissions(params: RbacPermissionSearchParams = {}): Promise<Paged<RbacPermission>> {
    const res = await apiClient.get<ApiEnvelope<Paged<RbacPermission>>>(`${BASE_PATH}/permissions`, {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  /**
   * 2. GET /permissions/{permissionId}
   * Get single permission detail with custom role usage count.
   */
  async getPermission(permissionId: string): Promise<RbacPermission> {
    const res = await apiClient.get<ApiEnvelope<RbacPermission>>(
      `${BASE_PATH}/permissions/${encodeURIComponent(permissionId)}`
    );
    return res.data.data;
  },

  /**
   * 3. PATCH /permissions/{permissionId}
   * Update permission description or active state.
   */
  async updatePermission(
    permissionId: string,
    input: RbacUpdatePermissionInput
  ): Promise<RbacPermission> {
    const payload = {
      description: input.description?.trim(),
      isActive: input.isActive,
      concurrencyToken: input.concurrencyToken,
      reason: input.reason.trim(),
    };
    const res = await apiClient.patch<ApiEnvelope<RbacPermission>>(
      `${BASE_PATH}/permissions/${encodeURIComponent(permissionId)}`,
      payload
    );
    return res.data.data;
  },

  // ── 2. Roles ────────────────────────────────────────────────────────────────

  /**
   * 4. GET /roles
   * List system and custom roles with search and filters.
   */
  async getRoles(params: RbacRoleSearchParams = {}): Promise<Paged<RbacRole>> {
    const res = await apiClient.get<ApiEnvelope<Paged<RbacRole>>>(`${BASE_PATH}/roles`, {
      params: cleanParams(params),
    });
    return res.data.data;
  },

  /**
   * 5. GET /roles/{roleId}
   * Get role details with active assignment count and permissions list.
   */
  async getRole(roleId: string): Promise<RbacRole> {
    const res = await apiClient.get<ApiEnvelope<RbacRole>>(
      `${BASE_PATH}/roles/${encodeURIComponent(roleId)}`
    );
    return res.data.data;
  },

  /**
   * 6. POST /roles
   * Create a new custom role. Code is normalized to UPPER_SNAKE_CASE.
   */
  async createRole(input: RbacCreateRoleInput): Promise<RbacRole> {
    const payload = {
      code: normalizeRoleCode(input.code),
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
    };
    const res = await apiClient.post<ApiEnvelope<RbacRole>>(`${BASE_PATH}/roles`, payload);
    return res.data.data;
  },

  /**
   * 7. PATCH /roles/{roleId}
   * Update custom role name, description, or active status.
   */
  async updateRole(roleId: string, input: RbacUpdateRoleInput): Promise<RbacRole> {
    const payload = {
      name: input.name?.trim(),
      description: input.description !== undefined ? input.description.trim() : undefined,
      isActive: input.isActive,
      concurrencyToken: input.concurrencyToken,
      reason: input.reason.trim(),
    };
    const res = await apiClient.patch<ApiEnvelope<RbacRole>>(
      `${BASE_PATH}/roles/${encodeURIComponent(roleId)}`,
      payload
    );
    return res.data.data;
  },

  /**
   * 8. DELETE /roles/{roleId}
   * Soft-delete a custom role with concurrencyToken & reason.
   */
  async deleteRole(
    roleId: string,
    input: RbacDeleteRoleInput
  ): Promise<{ success: boolean; message?: string }> {
    const res = await apiClient.delete<ApiEnvelope<unknown>>(
      `${BASE_PATH}/roles/${encodeURIComponent(roleId)}`,
      {
        data: {
          concurrencyToken: input.concurrencyToken,
          reason: input.reason.trim(),
        },
      }
    );
    return {
      success: res.data.success,
      message: res.data.message,
    };
  },

  /**
   * 9. PUT /roles/{roleId}/permissions
   * Replace permission matrix for custom role.
   * Empty array is valid. Duplicates are deduplicated before sending.
   */
  async replaceRolePermissions(
    roleId: string,
    input: RbacReplaceRolePermissionsInput
  ): Promise<RbacRole> {
    const deduplicatedIds = Array.from(new Set(input.permissionIds));
    const payload = {
      permissionIds: deduplicatedIds,
      concurrencyToken: input.concurrencyToken,
      reason: input.reason.trim(),
    };
    const res = await apiClient.put<ApiEnvelope<RbacRole>>(
      `${BASE_PATH}/roles/${encodeURIComponent(roleId)}/permissions`,
      payload
    );
    return res.data.data;
  },

  // ── 3. User Authorization ──────────────────────────────────────────────────

  /**
   * 10. GET /users/{userId}
   * Get user assigned roles and effective permissions with source roles.
   */
  async getUserAuthorization(userId: string): Promise<RbacUserAuthorization> {
    const res = await apiClient.get<ApiEnvelope<RbacUserAuthorization>>(
      `${BASE_PATH}/users/${encodeURIComponent(userId)}`
    );
    return res.data.data;
  },

  /**
   * 11. POST /users/{userId}/roles
   * Assign or reactivate a custom role for a user.
   */
  async assignUserRole(
    userId: string,
    input: RbacAssignUserRoleInput
  ): Promise<RbacUserAuthorization> {
    const payload = {
      roleId: input.roleId,
      concurrencyToken: input.concurrencyToken,
      reason: input.reason.trim(),
    };
    const res = await apiClient.post<ApiEnvelope<RbacUserAuthorization>>(
      `${BASE_PATH}/users/${encodeURIComponent(userId)}/roles`,
      payload
    );
    return res.data.data;
  },

  /**
   * 12. DELETE /users/{userId}/roles/{roleId}
   * Revoke a custom role assignment from a user.
   */
  async revokeUserRole(
    userId: string,
    roleId: string,
    input: RbacRevokeUserRoleInput
  ): Promise<RbacUserAuthorization> {
    const res = await apiClient.delete<ApiEnvelope<RbacUserAuthorization>>(
      `${BASE_PATH}/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`,
      {
        data: {
          concurrencyToken: input.concurrencyToken,
          reason: input.reason.trim(),
        },
      }
    );
    return res.data.data;
  },
};

export default rbacApi;
