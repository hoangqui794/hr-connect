/**
 * @file types/api/admin.ts
 * @description Admin API contracts mirrored from HRConnect.Application/Features/Admin.
 * Approval types stay in services/adminService.ts (already backend-accurate).
 */

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ── Users (/admin/users) ──────────────────────────────────────────────────────
/** Filter values accepted by GetAdminUsersQueryHandler. */
export type AdminUserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LOCKED' | 'REJECTED';
export type RoleCode = 'CANDIDATE' | 'AFFILIATE_RECRUITER' | 'CLIENT_COMPANY_USER' | 'INTERNAL_HR' | 'PLATFORM_ADMIN';

export interface AdminUserListItem {
  userId: string;
  email: string;
  displayName: string | null;
  status: AdminUserStatus | string;
  roles: RoleCode[];
  isLoginLocked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserDetail extends AdminUserListItem {
  phone: string | null;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  failedLoginAttempts: number;
  lockoutEndAt: string | null;
}

export interface AdminUserSearchParams {
  search?: string;
  status?: AdminUserStatus;
  role?: RoleCode;
  page: number;
  pageSize: number;
}

// ── Audit logs (/admin/audit-logs) ────────────────────────────────────────────
export interface AuditLogItem {
  auditLogId: number;
  actorUserId: string | null;
  actorType: string;
  actorDisplayName: string | null;
  actorEmail: string | null;
  action: string;
  source: string;
  serviceName: string | null;
  eventVersion: number;
  entityType: string | null;
  entityId: string | null;
  correlationId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogDetail extends AuditLogItem {
  oldValues: unknown;
  newValues: unknown;
}

export interface AuditLogSearchParams {
  actorUserId?: string;
  actorType?: string;
  action?: string;
  source?: string;
  entityType?: string;
  entityId?: string;
  fromUtc?: string;
  toUtc?: string;
  page: number;
  pageSize: number;
}

// ── Service types (/admin/service-types) ──────────────────────────────────────
export interface AdminServiceType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ServiceTypeInput {
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
}

/** Only roles already mapped to the service type are returned (no role catalog API). */
export interface ServiceTypeAllowedRole {
  roleId: string;
  roleCode: string;
  roleName: string;
  isRoleActive: boolean;
  canView: boolean;
  canSubmit: boolean;
}

// ── Commission rules (/admin/commission-rules) ────────────────────────────────
export type CommissionRateType = 'PERCENT' | 'FIXED';

export interface CommissionRule {
  commissionRuleId: string;
  serviceTypeId: string;
  serviceTypeCode: string;
  serviceTypeName?: string;
  name: string;
  milestoneType: string;
  milestoneName?: string | null;
  rateType: CommissionRateType;
  rateValue: number;
  warrantyRequired: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionMilestone {
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface CommissionRuleCreateInput {
  serviceTypeId: string;
  milestoneType: string;
  rateType: CommissionRateType;
  rateValue: number;
  warrantyRequired: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  isActive: boolean;
}

export interface CommissionRuleUpdateInput {
  rateType: CommissionRateType;
  rateValue: number;
  warrantyRequired: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}
