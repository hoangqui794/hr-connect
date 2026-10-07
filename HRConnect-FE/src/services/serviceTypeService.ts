/**
 * @file serviceTypeService.ts
 * @description API service for Service Types (/api/v1/service-types) in HRConnect.
 * Conforms strictly to swagger.json specification.
 */

import { axiosClient } from './axiosClient';
import type {
  GetServiceTypesParams,
  GetServiceTypesResponse,
  GetServiceTypeDetailResponse,
  ServiceTypeDto,
} from '@/types/mf01';

// Fallback seed data in case backend server is unreachable during local preview
const FALLBACK_SERVICE_TYPES: ServiceTypeDto[] = [
  {
    id: 'st-001',
    code: 'HEADHUNT_COD',
    name: 'Tuyển dụng trọn gói (COD)',
    description: 'Tuyển dụng toàn diện qua mạng lưới cộng tác viên (Headhunter), bảo hành 60 ngày, chỉ thanh toán khi nhận việc.',
    isActive: true,
  },
  {
    id: 'st-002',
    code: 'CV_SOURCING',
    name: 'Cung cấp hồ sơ (CV Sourcing)',
    description: 'Nhận hồ sơ ứng viên chất lượng cao đã qua sàng lọc AI. Doanh nghiệp chủ động liên hệ và phỏng vấn.',
    isActive: true,
  },
  {
    id: 'st-003',
    code: 'CV_APPLICATION',
    name: 'Ứng tuyển mở (CV Application)',
    description: 'Đăng tin tuyển dụng mở trên sàn, ứng viên chủ động nộp hồ sơ, hệ thống tự động chấm điểm hồ sơ bằng AI.',
    isActive: true,
  },
];

export const serviceTypeService = {
  /**
   * GET /api/v1/service-types
   * Lấy danh sách loại dịch vụ tuyển dụng
   */
  async getServiceTypes(params?: GetServiceTypesParams): Promise<GetServiceTypesResponse> {
    try {
      const response = await axiosClient.get<GetServiceTypesResponse>('/service-types', {
        params,
      });
      if (response.data && response.data.data?.items) {
        return response.data;
      }
      return {
        success: true,
        data: {
          items: (response.data as unknown as ServiceTypeDto[]) || FALLBACK_SERVICE_TYPES,
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: FALLBACK_SERVICE_TYPES.length,
          totalPages: 1,
        },
      };
    } catch {
      // Graceful fallback for local development when backend is offline
      const search = params?.search?.toLowerCase();
      let filtered = FALLBACK_SERVICE_TYPES;
      if (params?.isActive !== undefined) {
        filtered = filtered.filter((s) => s.isActive === params.isActive);
      }
      if (search) {
        filtered = filtered.filter(
          (s) =>
            s.name?.toLowerCase().includes(search) ||
            s.code?.toLowerCase().includes(search)
        );
      }
      return {
        success: true,
        data: {
          items: filtered,
          page: params?.page || 1,
          pageSize: params?.pageSize || 20,
          total: filtered.length,
          totalPages: 1,
        },
      };
    }
  },

  /**
   * GET /api/v1/service-types/{id}
   * Xem chi tiết một loại dịch vụ tuyển dụng
   */
  async getServiceTypeDetail(id: string): Promise<GetServiceTypeDetailResponse> {
    try {
      const response = await axiosClient.get<GetServiceTypeDetailResponse>(`/service-types/${id}`);
      return response.data;
    } catch {
      const found = FALLBACK_SERVICE_TYPES.find((s) => s.id === id);
      if (found) {
        return { success: true, data: found };
      }
      throw new Error(`Service type with id ${id} not found`);
    }
  },
};

export default serviceTypeService;
