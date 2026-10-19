/**
 * @file services/api/rbacApi.test.ts
 * @description Unit tests for RBAC API client (12 endpoints, payload normalization, error helpers).
 */

import { afterEach, describe, expect, it } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import { AxiosError, AxiosHeaders } from 'axios';
import { apiClient } from '../apiClient';
import { isRbacConflict, isSelfRoleMutationForbidden, rbacApi } from './rbacApi';
import { normalizeRoleCode } from '@/types/api/rbac';

describe('RBAC API Client', () => {
  afterEach(() => {
    apiClient.defaults.adapter = undefined;
  });

  describe('normalizeRoleCode helper', () => {
    it('normalizes raw string to UPPER_SNAKE_CASE', () => {
      expect(normalizeRoleCode('client reviewer')).toBe('CLIENT_REVIEWER');
      expect(normalizeRoleCode('hr-assistant-ops')).toBe('HR_ASSISTANT_OPS');
      expect(normalizeRoleCode('  finance_clerk_123  ')).toBe('FINANCE_CLERK_123');
      expect(normalizeRoleCode('___SPECIAL$$ROLE__')).toBe('SPECIAL_ROLE');
    });
  });

  describe('Error helpers', () => {
    it('identifies RBAC_CONCURRENCY_CONFLICT on 409', () => {
      const err = new AxiosError(
        'Conflict',
        'ERR_BAD_REQUEST',
        {} as InternalAxiosRequestConfig,
        undefined,
        {
          status: 409,
          statusText: 'Conflict',
          headers: new AxiosHeaders(),
          config: {} as InternalAxiosRequestConfig,
          data: { errorCode: 'RBAC_CONCURRENCY_CONFLICT', message: 'Dữ liệu đã thay đổi' },
        }
      );
      expect(isRbacConflict(err)).toBe(true);
      expect(isSelfRoleMutationForbidden(err)).toBe(false);
    });

    it('identifies SELF_ROLE_MUTATION_FORBIDDEN on 403', () => {
      const err = new AxiosError(
        'Forbidden',
        'ERR_BAD_REQUEST',
        {} as InternalAxiosRequestConfig,
        undefined,
        {
          status: 403,
          statusText: 'Forbidden',
          headers: new AxiosHeaders(),
          config: {} as InternalAxiosRequestConfig,
          data: { errorCode: 'SELF_ROLE_MUTATION_FORBIDDEN', message: 'Không thể tự sửa role' },
        }
      );
      expect(isSelfRoleMutationForbidden(err)).toBe(true);
      expect(isRbacConflict(err)).toBe(false);
    });
  });

  describe('Endpoints 1-3: Permissions', () => {
    it('1. getPermissions sends clean query params and returns paged data', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              items: [
                {
                  permissionId: 'perm-1',
                  code: 'role.view',
                  resource: 'role',
                  action: 'view',
                  description: 'Xem vai trò',
                  isActive: true,
                  isDelegable: true,
                  isProtected: false,
                  concurrencyToken: 'tok-1',
                },
              ],
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.getPermissions({
        search: 'role',
        resource: 'role',
        isActive: true,
        page: 1,
        pageSize: 20,
      });

      expect(capturedConfig?.url).toBe('/admin/authorization/permissions');
      expect(capturedConfig?.params).toEqual({
        search: 'role',
        resource: 'role',
        isActive: true,
        page: 1,
        pageSize: 20,
      });
      expect(res.items).toHaveLength(1);
      expect(res.items[0].code).toBe('role.view');
    });

    it('2. getPermission retrieves detail with customRoleUsageCount', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              permissionId: 'perm-1',
              code: 'role.view',
              resource: 'role',
              action: 'view',
              description: 'Xem vai trò',
              isActive: true,
              isDelegable: true,
              isProtected: false,
              concurrencyToken: 'tok-1',
              customRoleUsageCount: 3,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.getPermission('perm-1');
      expect(capturedConfig?.method).toBe('get');
      expect(capturedConfig?.url).toBe('/admin/authorization/permissions/perm-1');
      expect(res.customRoleUsageCount).toBe(3);
    });

    it('3. updatePermission patches description/isActive with reason & token', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              permissionId: 'perm-1',
              code: 'role.view',
              resource: 'role',
              action: 'view',
              description: 'Mô tả cập nhật',
              isActive: false,
              isDelegable: true,
              isProtected: false,
              concurrencyToken: 'tok-2',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.updatePermission('perm-1', {
        description: '  Mô tả cập nhật  ',
        isActive: false,
        concurrencyToken: 'tok-1',
        reason: '  Điều chỉnh quyền hạn  ',
      });

      expect(capturedConfig?.method).toBe('patch');
      expect(capturedConfig?.url).toBe('/admin/authorization/permissions/perm-1');
      expect(JSON.parse(capturedConfig?.data as string)).toEqual({
        description: 'Mô tả cập nhật',
        isActive: false,
        concurrencyToken: 'tok-1',
        reason: 'Điều chỉnh quyền hạn',
      });
      expect(res.concurrencyToken).toBe('tok-2');
    });
  });

  describe('Endpoints 4-9: Roles', () => {
    it('4. getRoles lists roles with filters', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              items: [
                {
                  roleId: 'role-1',
                  code: 'CLIENT_REVIEWER',
                  name: 'Nhân viên xem hồ sơ',
                  description: 'Chỉ xem',
                  isSystem: false,
                  isActive: true,
                  permissionCount: 5,
                  activeAssignmentCount: 2,
                  concurrencyToken: 'tok-r1',
                },
              ],
              page: 1,
              pageSize: 20,
              total: 1,
              totalPages: 1,
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.getRoles({ isSystem: false, isActive: true });
      expect(capturedConfig?.url).toBe('/admin/authorization/roles');
      expect(capturedConfig?.params).toEqual({ isSystem: false, isActive: true });
      expect(res.items[0].code).toBe('CLIENT_REVIEWER');
    });

    it('5. getRole gets role detail', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              roleId: 'role-1',
              code: 'CLIENT_REVIEWER',
              name: 'Nhân viên xem hồ sơ',
              isSystem: false,
              isActive: true,
              permissionCount: 2,
              activeAssignmentCount: 1,
              concurrencyToken: 'tok-r1',
              permissions: [],
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.getRole('role-1');
      expect(capturedConfig?.url).toBe('/admin/authorization/roles/role-1');
      expect(res.name).toBe('Nhân viên xem hồ sơ');
    });

    it('6. createRole normalizes code and posts new custom role', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              roleId: 'role-new',
              code: 'AUDIT_OFFICER',
              name: 'Cán bộ kiểm tra',
              isSystem: false,
              isActive: true,
              permissionCount: 0,
              activeAssignmentCount: 0,
              concurrencyToken: 'tok-init',
            },
          },
          status: 201,
          statusText: 'Created',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.createRole({
        code: 'audit officer',
        name: ' Cán bộ kiểm tra ',
        description: ' Giám sát tuân thủ ',
      });

      expect(capturedConfig?.method).toBe('post');
      expect(capturedConfig?.url).toBe('/admin/authorization/roles');
      expect(JSON.parse(capturedConfig?.data as string)).toEqual({
        code: 'AUDIT_OFFICER',
        name: 'Cán bộ kiểm tra',
        description: 'Giám sát tuân thủ',
      });
      expect(res.roleId).toBe('role-new');
    });

    it('7. updateRole patches custom role', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              roleId: 'role-1',
              code: 'AUDIT_OFFICER',
              name: 'Tên mới',
              concurrencyToken: 'tok-r2',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.updateRole('role-1', {
        name: 'Tên mới',
        isActive: true,
        concurrencyToken: 'tok-r1',
        reason: 'Cập nhật tên',
      });

      expect(capturedConfig?.method).toBe('patch');
      expect(capturedConfig?.url).toBe('/admin/authorization/roles/role-1');
      expect(res.concurrencyToken).toBe('tok-r2');
    });

    it('8. deleteRole sends concurrencyToken and reason in body', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: { success: true, message: 'Role deleted' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.deleteRole('role-1', {
        concurrencyToken: 'tok-r1',
        reason: 'Ngừng sử dụng',
      });

      expect(capturedConfig?.method).toBe('delete');
      expect(capturedConfig?.url).toBe('/admin/authorization/roles/role-1');
      expect(JSON.parse(capturedConfig?.data as string)).toEqual({
        concurrencyToken: 'tok-r1',
        reason: 'Ngừng sử dụng',
      });
      expect(res.success).toBe(true);
    });

    it('9. replaceRolePermissions deduplicates IDs and puts matrix', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              roleId: 'role-1',
              permissionCount: 2,
              concurrencyToken: 'tok-r3',
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.replaceRolePermissions('role-1', {
        permissionIds: ['p-1', 'p-2', 'p-1'],
        concurrencyToken: 'tok-r2',
        reason: 'Cập nhật ma trận',
      });

      expect(capturedConfig?.method).toBe('put');
      expect(capturedConfig?.url).toBe('/admin/authorization/roles/role-1/permissions');
      expect(JSON.parse(capturedConfig?.data as string)).toEqual({
        permissionIds: ['p-1', 'p-2'],
        concurrencyToken: 'tok-r2',
        reason: 'Cập nhật ma trận',
      });
      expect(res.permissionCount).toBe(2);
    });
  });

  describe('Endpoints 10-12: User Authorization', () => {
    it('10. getUserAuthorization returns user roles and effective permissions with sourceRoles', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              userId: 'u-1',
              email: 'user1@example.com',
              status: 'ACTIVE',
              authorizationConcurrencyToken: 'auth-tok-1',
              roles: [
                {
                  roleId: 'role-custom-1',
                  roleCode: 'CLIENT_REVIEWER',
                  roleName: 'Nhân viên xem hồ sơ',
                  isSystem: false,
                  status: 'ACTIVE',
                  assignedAt: '2026-10-19T00:00:00Z',
                },
              ],
              effectivePermissions: [
                {
                  permissionId: 'p-1',
                  code: 'candidate.view',
                  resource: 'candidate',
                  action: 'view',
                  description: 'Xem ứng viên',
                  sourceRoles: ['CLIENT_REVIEWER'],
                },
              ],
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.getUserAuthorization('u-1');
      expect(capturedConfig?.url).toBe('/admin/authorization/users/u-1');
      expect(res.effectivePermissions[0].sourceRoles).toContain('CLIENT_REVIEWER');
    });

    it('11. assignUserRole posts roleId, concurrencyToken, and reason', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              userId: 'u-1',
              authorizationConcurrencyToken: 'auth-tok-2',
              roles: [],
              effectivePermissions: [],
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.assignUserRole('u-1', {
        roleId: 'role-custom-1',
        concurrencyToken: 'auth-tok-1',
        reason: 'Phân công nhiệm vụ',
      });

      expect(capturedConfig?.method).toBe('post');
      expect(capturedConfig?.url).toBe('/admin/authorization/users/u-1/roles');
      expect(JSON.parse(capturedConfig?.data as string)).toEqual({
        roleId: 'role-custom-1',
        concurrencyToken: 'auth-tok-1',
        reason: 'Phân công nhiệm vụ',
      });
      expect(res.authorizationConcurrencyToken).toBe('auth-tok-2');
    });

    it('12. revokeUserRole sends concurrencyToken and reason in delete body', async () => {
      let capturedConfig: InternalAxiosRequestConfig | undefined;
      apiClient.defaults.adapter = async (config) => {
        capturedConfig = config;
        return {
          data: {
            success: true,
            data: {
              userId: 'u-1',
              authorizationConcurrencyToken: 'auth-tok-3',
              roles: [],
              effectivePermissions: [],
            },
          },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        };
      };

      const res = await rbacApi.revokeUserRole('u-1', 'role-custom-1', {
        concurrencyToken: 'auth-tok-2',
        reason: 'Hết nhiệm kỳ',
      });

      expect(capturedConfig?.method).toBe('delete');
      expect(capturedConfig?.url).toBe('/admin/authorization/users/u-1/roles/role-custom-1');
      expect(JSON.parse(capturedConfig?.data as string)).toEqual({
        concurrencyToken: 'auth-tok-2',
        reason: 'Hết nhiệm kỳ',
      });
      expect(res.authorizationConcurrencyToken).toBe('auth-tok-3');
    });
  });
});
