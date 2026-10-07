/**
 * @file useAdminApprovals.ts
 * @description React Query hooks for Centralized Admin Approvals Hub.
 * Uses query key ['admin', 'approvals'] with automatic cache invalidation on mutations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApprovalService } from '@/services/adminApprovalService';
import type {
  GetApprovalListParams,
  ApproveAffiliateRequest,
  RejectAffiliateRequest,
  ApproveCompanyRequest,
  RejectCompanyRequest,
} from '@/types/admin';

export const adminApprovalKeys = {
  all: ['admin', 'approvals'] as const,
  list: (params?: GetApprovalListParams) => [...adminApprovalKeys.all, 'list', params] as const,
  affiliateDetail: (id: string) => [...adminApprovalKeys.all, 'affiliate', id] as const,
  companyDetail: (id: string) => [...adminApprovalKeys.all, 'company', id] as const,
};

/**
 * Hook query danh sách phê duyệt tập trung: GET /api/v1/admin/approvals
 */
export function useAdminApprovals(params?: GetApprovalListParams) {
  return useQuery({
    queryKey: adminApprovalKeys.list(params),
    queryFn: () => adminApprovalService.getApprovals(params),
    staleTime: 10000,
  });
}

/**
 * Hook query chi tiết đơn Affiliate: GET /api/v1/admin/affiliate-applications/{id}
 */
export function useAffiliateApplicationDetail(id: string) {
  return useQuery({
    queryKey: adminApprovalKeys.affiliateDetail(id),
    queryFn: () => adminApprovalService.getAffiliateApplicationDetail(id),
    enabled: Boolean(id),
    staleTime: 30000,
  });
}

/**
 * Hook query chi tiết yêu cầu xác thực Doanh nghiệp: GET /api/v1/admin/company-verification-requests/{id}
 */
export function useCompanyVerificationDetail(id: string) {
  return useQuery({
    queryKey: adminApprovalKeys.companyDetail(id),
    queryFn: () => adminApprovalService.getCompanyVerificationDetail(id),
    enabled: Boolean(id),
    staleTime: 30000,
  });
}

/**
 * Mutation phê duyệt Affiliate: POST /api/v1/admin/affiliate-applications/{id}/approve
 */
export function useApproveAffiliate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: ApproveAffiliateRequest }) =>
      adminApprovalService.approveAffiliate(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminApprovalKeys.all });
    },
  });
}

/**
 * Mutation từ chối Affiliate: POST /api/v1/admin/affiliate-applications/{id}/reject
 */
export function useRejectAffiliate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RejectAffiliateRequest }) =>
      adminApprovalService.rejectAffiliate(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminApprovalKeys.all });
    },
  });
}

/**
 * Mutation phê duyệt Doanh nghiệp: POST /api/v1/admin/company-verification-requests/{id}/approve
 */
export function useApproveCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: ApproveCompanyRequest }) =>
      adminApprovalService.approveCompany(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminApprovalKeys.all });
    },
  });
}

/**
 * Mutation từ chối Doanh nghiệp: POST /api/v1/admin/company-verification-requests/{id}/reject
 */
export function useRejectCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RejectCompanyRequest }) =>
      adminApprovalService.rejectCompany(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminApprovalKeys.all });
    },
  });
}
