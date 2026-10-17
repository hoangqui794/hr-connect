import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminCommissionApi } from './adminApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('adminCommissionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('fetches commission rules with pagination and filters', async () => {
      const mockResult = {
        data: {
          items: [
            {
              commissionRuleId: 'rule-1',
              serviceTypeId: 'srv-1',
              serviceTypeCode: 'RECRUITMENT',
              serviceTypeName: 'Tuyển dụng',
              name: 'Quy tắc tiêu chuẩn',
              milestoneType: 'ONBOARDED',
              milestoneName: 'Ứng viên đi làm',
              rateType: 'PERCENT',
              rateValue: 15,
              warrantyRequired: true,
              effectiveFrom: '2026-01-01T00:00:00Z',
              effectiveTo: null,
              isActive: true,
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockResult } as any);

      const result = await adminCommissionApi.list({
        serviceTypeId: 'srv-1',
        isActive: true,
        page: 1,
        pageSize: 20,
      });

      expect(apiClient.get).toHaveBeenCalledWith('/admin/commission-rules', {
        params: {
          serviceTypeId: 'srv-1',
          isActive: true,
          page: 1,
          pageSize: 20,
        },
      });
      expect(result).toEqual(mockResult.data);
    });
  });

  describe('setActive', () => {
    it('calls activate endpoint when active is true', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Đã kích hoạt quy tắc hoa hồng.',
          data: {
            commissionRuleId: 'rule-1',
            isActive: true,
            updatedAt: '2026-10-17T00:00:00Z',
          },
        },
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await adminCommissionApi.setActive('rule-1', true);

      expect(apiClient.patch).toHaveBeenCalledWith('/admin/commission-rules/rule-1/activate');
      expect(res).toEqual(mockResponse);
    });

    it('calls deactivate endpoint when active is false', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Đã ngừng hiệu lực quy tắc hoa hồng.',
          data: {
            commissionRuleId: 'rule-1',
            isActive: false,
            updatedAt: '2026-10-17T00:00:00Z',
          },
        },
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await adminCommissionApi.setActive('rule-1', false);

      expect(apiClient.patch).toHaveBeenCalledWith('/admin/commission-rules/rule-1/deactivate');
      expect(res).toEqual(mockResponse);
    });
  });

  describe('toggleActive', () => {
    it('calls deactivate endpoint when currentActive is true', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Đã ngừng hiệu lực quy tắc hoa hồng.',
          data: {
            commissionRuleId: 'rule-1',
            isActive: false,
            updatedAt: '2026-10-17T00:00:00Z',
          },
        },
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await adminCommissionApi.toggleActive('rule-1', true);

      expect(apiClient.patch).toHaveBeenCalledWith('/admin/commission-rules/rule-1/deactivate');
      expect(res).toEqual(mockResponse);
    });

    it('calls activate endpoint when currentActive is false', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Đã kích hoạt quy tắc hoa hồng.',
          data: {
            commissionRuleId: 'rule-2',
            isActive: true,
            updatedAt: '2026-10-17T00:00:00Z',
          },
        },
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await adminCommissionApi.toggleActive('rule-2', false);

      expect(apiClient.patch).toHaveBeenCalledWith('/admin/commission-rules/rule-2/activate');
      expect(res).toEqual(mockResponse);
    });
  });

  describe('updateStatus', () => {
    it('delegates to setActive with boolean flag', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Đã kích hoạt quy tắc hoa hồng.',
          data: {
            commissionRuleId: 'rule-3',
            isActive: true,
            updatedAt: '2026-10-17T00:00:00Z',
          },
        },
      };

      vi.mocked(apiClient.patch).mockResolvedValueOnce({ data: mockResponse } as any);

      const res = await adminCommissionApi.updateStatus('rule-3', true);

      expect(apiClient.patch).toHaveBeenCalledWith('/admin/commission-rules/rule-3/activate');
      expect(res).toEqual(mockResponse);
    });
  });
});
