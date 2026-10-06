/**
 * @file adminService.ts
 * @description Admin Approvals & Verification Service conforming to OpenAPI backend spec.
 * Handles Company Verification Requests and Affiliate Application reviews.
 */

import apiClient from './apiClient';

export interface ApprovalListItemDto {
  approvalId: string;
  type: 'AFFILIATE' | 'CLIENT';
  userId: string;
  email: string;
  displayName: string;
  companyName?: string | null;
  status: string; // 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
  submittedAt: string;
}

export interface GetApprovalListParams {
  type?: 'AFFILIATE' | 'CLIENT';
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'submittedAt' | 'status' | 'type';
  sortDirection?: 'asc' | 'desc';
}

export interface GetApprovalListResponse {
  success: boolean;
  data: {
    items: ApprovalListItemDto[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CompanyVerificationDetailDto {
  verificationRequestId: string;
  userId: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  companyId: string;
  companyName: string;
  taxCode?: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  address?: string | null;
  description?: string | null;
  submittedPayload: string;
  status: string;
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

export interface AffiliateApplicationDetailDto {
  applicationId: string;
  userId: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  affiliateType: string;
  submittedData: string;
  status: string;
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

export interface ApprovalActionResponse {
  success: boolean;
  message?: string;
}

class AdminService {
  /**
   * GET /api/v1/admin/approvals
   * Unified Approval List with filtering by type (CLIENT / AFFILIATE) and status
   */
  public async getApprovals(params: GetApprovalListParams = {}): Promise<GetApprovalListResponse> {
    const response = await apiClient.get<GetApprovalListResponse>('/admin/approvals', {
      params: {
        type: params.type,
        status: params.status,
        search: params.search,
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 20,
        sortBy: params.sortBy ?? 'submittedAt',
        sortDirection: params.sortDirection ?? 'desc',
      },
    });
    return response.data;
  }

  /**
   * GET /api/v1/admin/company-verification-requests/{id}
   */
  public async getCompanyVerificationDetail(
    requestId: string
  ): Promise<GetCompanyVerificationDetailResponse> {
    const response = await apiClient.get<GetCompanyVerificationDetailResponse>(
      `/admin/company-verification-requests/${requestId}`
    );
    return response.data;
  }

  /**
   * POST /api/v1/admin/company-verification-requests/{id}/approve
   */
  public async approveCompanyVerification(
    requestId: string,
    note?: string
  ): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(
      `/admin/company-verification-requests/${requestId}/approve`,
      { note }
    );
    return response.data;
  }

  /**
   * POST /api/v1/admin/company-verification-requests/{id}/reject
   */
  public async rejectCompanyVerification(
    requestId: string,
    reason: string
  ): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(
      `/admin/company-verification-requests/${requestId}/reject`,
      { reason }
    );
    return response.data;
  }

  /**
   * GET /api/v1/admin/affiliate-applications/{id}
   */
  public async getAffiliateApplicationDetail(
    applicationId: string
  ): Promise<GetAffiliateApplicationDetailResponse> {
    const response = await apiClient.get<GetAffiliateApplicationDetailResponse>(
      `/admin/affiliate-applications/${applicationId}`
    );
    return response.data;
  }

  /**
   * POST /api/v1/admin/affiliate-applications/{id}/approve
   */
  public async approveAffiliate(
    applicationId: string,
    note?: string
  ): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(
      `/admin/affiliate-applications/${applicationId}/approve`,
      { note }
    );
    return response.data;
  }

  /**
   * POST /api/v1/admin/affiliate-applications/{id}/reject
   */
  public async rejectAffiliate(
    applicationId: string,
    reason: string
  ): Promise<ApprovalActionResponse> {
    const response = await apiClient.post<ApprovalActionResponse>(
      `/admin/affiliate-applications/${applicationId}/reject`,
      { reason }
    );
    return response.data;
  }
}

export const adminService = new AdminService();
export default adminService;
