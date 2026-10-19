/**
 * @file types/api/rbac.ts
 * @description RBAC API contracts mirrored from HRConnect RBAC authorization specs.
 * Covers 12 endpoints for Permissions, Roles, and User Authorization.
 */

import type { ApiEnvelope, Paged } from './admin';

export type { ApiEnvelope, Paged };

// ── Permission Catalog (/admin/authorization/permissions) ────────────────────

export interface RbacPermission {
  permissionId: string;
  code: string;
  resource: string;
  action: string;
  description: string | null;
  isActive: boolean;
  isDelegable: boolean;
  isProtected: boolean;
  concurrencyToken: string;
  customRoleUsageCount?: number;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface RbacPermissionSearchParams {
  search?: string;
  resource?: string;
  action?: string;
  isActive?: boolean;
  isDelegable?: boolean;
  page?: number;
  pageSize?: number;
}

export interface RbacUpdatePermissionInput {
  description?: string;
  isActive?: boolean;
  concurrencyToken: string;
  reason: string;
}

// ── Roles (/admin/authorization/roles) ────────────────────────────────────────

export interface RbacRole {
  roleId: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissionCount: number;
  activeAssignmentCount: number;
  concurrencyToken: string;
  createdAt?: string;
  updatedAt?: string | null;
  permissions?: RbacPermission[];
}

export interface RbacRoleSearchParams {
  search?: string;
  isSystem?: boolean;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface RbacCreateRoleInput {
  code: string;
  name: string;
  description?: string;
}

export interface RbacUpdateRoleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
  concurrencyToken: string;
  reason: string;
}

export interface RbacDeleteRoleInput {
  concurrencyToken: string;
  reason: string;
}

export interface RbacReplaceRolePermissionsInput {
  permissionIds: string[];
  concurrencyToken: string;
  reason: string;
}

// ── User Authorization (/admin/authorization/users) ──────────────────────────

export interface RbacUserRoleAssignment {
  assignmentId?: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  isSystem: boolean;
  status: 'ACTIVE' | 'REVOKED' | string;
  assignedAt: string;
  assignedBy?: string | null;
  assignedByEmail?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokedByEmail?: string | null;
  assignReason?: string | null;
  revokeReason?: string | null;
}

export interface RbacEffectivePermission {
  permissionId: string;
  code: string;
  resource: string;
  action: string;
  description: string | null;
  sourceRoles: string[];
}

export interface RbacUserAuthorization {
  userId: string;
  email: string;
  status: string;
  authorizationConcurrencyToken: string;
  roles: RbacUserRoleAssignment[];
  effectivePermissions: RbacEffectivePermission[];
}

export interface RbacAssignUserRoleInput {
  roleId: string;
  concurrencyToken: string;
  reason: string;
}

export interface RbacRevokeUserRoleInput {
  concurrencyToken: string;
  reason: string;
}

// ── Error Codes & Helpers ───────────────────────────────────────────────────

export const RBAC_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_PERMISSION_ID: 'DUPLICATE_PERMISSION_ID',
  SELF_ROLE_MUTATION_FORBIDDEN: 'SELF_ROLE_MUTATION_FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  RBAC_CONCURRENCY_CONFLICT: 'RBAC_CONCURRENCY_CONFLICT',
  SYSTEM_ROLE_IMMUTABLE: 'SYSTEM_ROLE_IMMUTABLE',
  ROLE_IN_USE: 'ROLE_IN_USE',
  ROLE_INACTIVE: 'ROLE_INACTIVE',
  USER_INACTIVE: 'USER_INACTIVE',
  NON_DELEGABLE_PERMISSION: 'NON_DELEGABLE_PERMISSION',
  PROTECTED_PERMISSION: 'PROTECTED_PERMISSION',
  ROLE_CODE_EXISTS: 'ROLE_CODE_EXISTS',
} as const;

export type RbacErrorCode = (typeof RBAC_ERROR_CODES)[keyof typeof RBAC_ERROR_CODES];

/** Normalizes role code to UPPER_SNAKE_CASE (A-Z, 0-9, _) */
export const normalizeRoleCode = (raw: string): string =>
  raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** Check if permission can be delegated to a custom role */
export const isDelegablePermission = (perm: Pick<RbacPermission, 'isActive' | 'isDelegable' | 'isProtected'>): boolean =>
  Boolean(perm.isActive && perm.isDelegable && !perm.isProtected);
