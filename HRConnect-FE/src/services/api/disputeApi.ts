/**
 * @file disputeApi.ts
 * @description API client for SF-04 Disputes (Affiliate and Platform Admin).
 */

import { apiClient } from '@/services/apiClient';
import type {
  MyDisputeDto,
  AdminDisputeListItemDto,
  AdminDisputeDetailDto,
  DisputePageDto,
  CreateDisputeRequest,
  ResolveDisputeRequest,
} from '@/types/api/dispute';

const cleanParams = <T extends object>(params?: T): Partial<T> | undefined => {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
  ) as Partial<T>;
};

export const disputeApi = {
  /**
   * POST /api/v1/disputes
   * Affiliate gửi khiếu nại trùng ứng viên hoặc attribution.
   */
  async createDispute(body: CreateDisputeRequest): Promise<MyDisputeDto> {
    const response = await apiClient.post<{ success: boolean; data: MyDisputeDto }>('/disputes', body);
    return response.data.data;
  },

  /**
   * GET /api/v1/disputes/mine
   * Lấy danh sách khiếu nại của chính Affiliate đang đăng nhập.
   */
  async getMyDisputes(status?: string): Promise<MyDisputeDto[]> {
    const response = await apiClient.get<{ success: boolean; data: MyDisputeDto[] }>('/disputes/mine', {
      params: cleanParams({ status }),
    });
    return response.data.data ?? [];
  },

  /**
   * GET /api/v1/admin/disputes
   * Hàng chờ khiếu nại cho Platform Admin.
   */
  async getAdminDisputes(params?: {
    status?: string;
    type?: string;
    page?: number;
    pageSize?: number;
  }): Promise<DisputePageDto> {
    const response = await apiClient.get<{ success: boolean; data: DisputePageDto }>('/admin/disputes', {
      params: cleanParams(params),
    });
    return response.data.data ?? { items: [], totalCount: 0, page: 1, pageSize: 20 };
  },

  /**
   * GET /api/v1/admin/disputes/{disputeId}
   * Chi tiết khiếu nại để Admin đối soát và xử lý.
   */
  async getAdminDisputeDetail(disputeId: string): Promise<AdminDisputeDetailDto> {
    const response = await apiClient.get<{ success: boolean; data: AdminDisputeDetailDto }>(
      `/admin/disputes/${disputeId}`
    );
    return response.data.data;
  },

  /**
   * POST /api/v1/admin/disputes/{disputeId}/resolve
   * Platform Admin ra quyết định giải quyết (UPHELD hoặc REJECTED).
   */
  async resolveDispute(
    disputeId: string,
    body: ResolveDisputeRequest
  ): Promise<AdminDisputeDetailDto> {
    const response = await apiClient.post<{ success: boolean; data: AdminDisputeDetailDto }>(
      `/admin/disputes/${disputeId}/resolve`,
      body
    );
    return response.data.data;
  },
};

export default disputeApi;
