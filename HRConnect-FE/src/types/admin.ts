/**
 * @file admin.ts
 * @description Type definitions and DTO contracts for Platform Admin (A-02) role.
 * Derived strictly from swagger.json root specifications.
 */

// ─── Admin Approvals Contracts ──────────────────────────────────────────────

export type ApprovalType = 'AFFILIATE' | 'CLIENT';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * Parameter query cho GET /api/v1/admin/approvals
 */
export interface GetApprovalListParams {
  type?: 'AFFILIATE' | 'CLIENT' | string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc' | string;
}

/**
 * Item trong danh sách yêu cầu phê duyệt
 */
export interface ApprovalListItemDto {
  approvalId: string;
  type?: string | null;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  companyName?: string | null;
  status?: string | null;
  submittedAt: string;
}

export interface GetApprovalListData {
  items: ApprovalListItemDto[] | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GetApprovalListResponse {
  success: boolean;
  data?: GetApprovalListData;
}

/**
 * DTO chi tiết đơn đăng ký Affiliate Recruiter
 * GET /api/v1/admin/affiliate-applications/{id}
 */
export interface AffiliateApplicationDetailDto {
  applicationId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  affiliateType?: string | null;
  taxInformation?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  submittedData?: string | null;
  status?: string | null;
  submittedAt: string;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

export interface GetAffiliateApplicationDetailResponse {
  success: boolean;
  data?: AffiliateApplicationDetailDto;
}

/**
 * POST /api/v1/admin/affiliate-applications/{id}/approve
 */
export interface ApproveAffiliateRequest {
  note?: string | null;
}

export interface ApproveAffiliateResponse {
  success: boolean;
  message?: string | null;
}

/**
 * POST /api/v1/admin/affiliate-applications/{id}/reject
 */
export interface RejectAffiliateRequest {
  reason: string;
}

export interface RejectAffiliateResponse {
  success: boolean;
  message?: string | null;
}

/**
 * DTO chi tiết yêu cầu xác thực Doanh nghiệp (Client Company)
 * GET /api/v1/admin/company-verification-requests/{id}
 */
export interface CompanyVerificationDetailDto {
  verificationRequestId: string;
  userId: string;
  email?: string | null;
  displayName?: string | null;
  phone?: string | null;
  companyId: string;
  companyName?: string | null;
  taxCode?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  address?: string | null;
  description?: string | null;
  submittedPayload?: string | null;
  status?: string | null;
  submittedAt: string;
  reviewedBy?: string | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
}

export interface GetCompanyVerificationDetailResponse {
  success: boolean;
  data?: CompanyVerificationDetailDto;
}

/**
 * POST /api/v1/admin/company-verification-requests/{id}/approve
 */
export interface ApproveCompanyRequest {
  note?: string | null;
}

export interface ApproveCompanyResponse {
  success: boolean;
  message?: string | null;
}

/**
 * POST /api/v1/admin/company-verification-requests/{id}/reject
 */
export interface RejectCompanyRequest {
  reason: string;
}

export interface RejectCompanyResponse {
  success: boolean;
  message?: string | null;
}

// ─── Admin Service Types Contracts ──────────────────────────────────────────

/**
 * DTO Loại dịch vụ tuyển dụng
 */
export interface ServiceTypeDto {
  id: string;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GetServiceTypesParams {
  search?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc' | string;
}

export interface GetServiceTypesData {
  items: ServiceTypeDto[] | null;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GetServiceTypesResponse {
  success: boolean;
  message?: string | null;
  data?: GetServiceTypesData;
}

export interface GetServiceTypeDetailResponse {
  success: boolean;
  message?: string | null;
  data?: ServiceTypeDto;
}

/**
 * POST /api/v1/admin/service-types
 */
export interface CreateServiceTypeCommand {
  code?: string | null;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
}

export interface CreateServiceTypeResponse {
  success: boolean;
  message?: string | null;
  data?: ServiceTypeDto;
}

/**
 * PUT /api/v1/admin/service-types/{id}
 */
export interface UpdateServiceTypeCommand {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  isActive: boolean;
}

export interface UpdateServiceTypeResponse {
  success: boolean;
  message?: string | null;
  data?: ServiceTypeDto;
}

/**
 * DELETE /api/v1/admin/service-types/{id}
 */
export interface DeleteServiceTypeResponse {
  success: boolean;
  message?: string | null;
  isDeactivated: boolean;
}
