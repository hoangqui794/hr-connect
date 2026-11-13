import { describe, it, expect, vi, beforeEach } from 'vitest';
import { placementApi, reportCandidateResignation, selfReportResignation } from './placementApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  getApiError: vi.fn((err: any, fallback: string) => ({
    message: err?.response?.data?.message || err?.message || fallback,
    statusCode: err?.response?.status,
  })),
}));

describe('placementApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPlacementDetail', () => {
    it('calls GET /placements/{placementId} and returns formatted placement detail', async () => {
      const mockRaw = {
        placementId: 'plc-1',
        applicationId: 'app-1',
        offerId: 'off-1',
        actualStartDate: '2026-10-15',
        position: 'Lead React Architect',
        department: 'Product Engineering',
        status: 'STARTED',
        confirmedAt: '2026-10-15T08:30:00Z',
        confirmedByName: 'Admin Trần',
        confirmationNote: 'Ứng viên đã nhận việc đầy đủ thiết bị',
        candidate: {
          candidateId: 'cand-1',
          fullName: 'Trương Hoàng Nam',
          email: 'nam.truong@example.com',
          phone: '0987654321',
          summary: '8 năm kinh nghiệm React, TypeScript, microfrontends',
        },
        job: {
          jobId: 'job-1',
          title: 'Lead Frontend Architect',
          companyId: 'comp-1',
          companyName: 'Fintech Unicorn Corp',
        },
        offer: {
          offerId: 'off-1',
          salary: 50000000,
          currencyCode: 'VND',
          startDate: '2026-10-15',
          status: 'ACCEPTED',
          offerDocumentUrl: 'https://cdn.hrconnect.vn/offers/off-1.pdf',
        },
        probation: {
          probationId: 'prb-1',
          startDate: '2026-10-15',
          endDate: '2026-12-15',
          result: 'IN_PROGRESS',
          notes: 'Đánh giá 60 ngày thử việc',
        },
        warranty: {
          warrantyId: 'war-1',
          startDate: '2026-10-15',
          endDate: '2027-01-15',
          status: 'ACTIVE',
          resultNote: null,
        },
        allowedActions: ['VIEW_PLACEMENT', 'VIEW_PROBATION', 'VIEW_WARRANTY'],
        createdAt: '2026-10-15T08:30:00Z',
        updatedAt: '2026-10-15T08:30:00Z',
        financial: {
          serviceFeeAmount: 40000000,
          serviceFeeStatus: 'PAID',
          commissionAmount: 12000000,
          commissionStatus: 'APPROVED',
        },
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockRaw,
        },
      } as any);

      const result = await placementApi.getPlacementDetail('plc-1');

      expect(apiClient.get).toHaveBeenCalledWith('/placements/plc-1');
      expect(result.placementId).toBe('plc-1');
      expect(result.position).toBe('Lead React Architect');
      expect(result.candidate.fullName).toBe('Trương Hoàng Nam');
      expect(result.job.companyName).toBe('Fintech Unicorn Corp');
      expect(result.offer.salary).toBe(50000000);
      expect(result.probation?.result).toBe('IN_PROGRESS');
      expect(result.warranty?.status).toBe('ACTIVE');
      expect(result.financial?.serviceFeeAmount).toBe(40000000);
      expect(result.financial?.commissionStatus).toBe('APPROVED');
      // Không còn gọi thêm /warranties để dò khối tiền.
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result.isReplacement).toBe(false);
      expect(result.replacesPlacementId).toBeNull();
    });

    it('throws error when request fails or returns null', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Placement not found'));

      await expect(placementApi.getPlacementDetail('plc-err')).rejects.toThrow(
        'Placement not found'
      );
    });
  });

  describe('reportResignation', () => {
    it('calls POST /placements/{placementId}/resignation with resignation details', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } } as any);

      const res = await placementApi.reportResignation('plc-1', {
        lastWorkingDate: '2026-11-01',
        reason: 'Ứng viên chuyển nơi cư trú',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/placements/plc-1/resignation', {
        lastWorkingDate: '2026-11-01',
        reason: 'Ứng viên chuyển nơi cư trú',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('resolveResignation', () => {
    it('calls POST /placements/{placementId}/resignation/resolve with decision', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            placementId: 'plc-1',
            warrantyStatus: 'VOIDED',
            placementStatus: 'RESIGNED',
          },
        },
      } as any);

      const res = await placementApi.resolveResignation('plc-1', {
        confirmed: true,
        note: 'Đã xác minh qua hồ sơ nhân sự',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/placements/plc-1/resignation/resolve', {
        confirmed: true,
        note: 'Đã xác minh qua hồ sơ nhân sự',
      });
      expect(res.warrantyStatus).toBe('VOIDED');
    });
  });

  describe('reportCandidateResignation', () => {
    it('calls POST /recruitment/applications/:id/resignation successfully', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Đã báo nghỉ việc thành công.' },
      } as any);

      const res = await reportCandidateResignation('app-1', {
        resignationDate: '2026-11-12',
        reason: 'EMPLOYEE_RESIGNED',
        note: 'Gia đình chuyển nhà',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/recruitment/applications/app-1/resignation', {
        resignationDate: '2026-11-12',
        reason: 'EMPLOYEE_RESIGNED',
        note: 'Gia đình chuyển nhà',
      });
      expect(res.success).toBe(true);
    });

    it('falls back to /placements/:id/resignation when recruitment endpoint returns 404', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: { status: 404 },
      });
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Đã báo nghỉ việc fallback thành công.' },
      } as any);

      const res = await reportCandidateResignation('plc-1', {
        resignationDate: '2026-11-12',
        reason: 'PROBATION_FAILED',
        note: 'Không đạt thử việc',
      });

      expect(apiClient.post).toHaveBeenNthCalledWith(
        2,
        '/placements/plc-1/resignation',
        {
          lastWorkingDate: '2026-11-12',
          reason: 'PROBATION_FAILED: Không đạt thử việc',
        }
      );
      expect(res.success).toBe(true);
    });

    it('returns graceful mock fallback when both primary and secondary return 404', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 404 } });
      vi.mocked(apiClient.post).mockRejectedValueOnce({ response: { status: 404 } });

      const res = await reportCandidateResignation('plc-1', {
        resignationDate: '2026-11-12',
        reason: 'OTHER',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Đã ghi nhận báo nghỉ việc thành công.');
    });

    it('throws formatted error on other errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: { status: 400, data: { message: 'Dữ liệu không hợp lệ' } },
      });

      await expect(
        reportCandidateResignation('app-1', {
          resignationDate: '2026-11-12',
          reason: 'OTHER',
        })
      ).rejects.toThrow('Dữ liệu không hợp lệ');
    });

    it('calls via placementApi wrapper', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const res = await placementApi.reportCandidateResignation('app-1', {
        resignationDate: '2026-11-12',
        reason: 'OTHER',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('selfReportResignation', () => {
    it('calls POST /recruitment/applications/:id/resignation successfully', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Đã cập nhật trạng thái nghỉ việc thành công.' },
      } as any);

      const res = await selfReportResignation('app-1', {
        resignationDate: '2026-11-12',
        reason: 'Chuyển định hướng nghề nghiệp',
        note: 'Cảm ơn công ty',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/recruitment/applications/app-1/resignation', {
        resignationDate: '2026-11-12',
        reason: 'Chuyển định hướng nghề nghiệp',
        note: 'Cảm ơn công ty',
      });
      expect(res.success).toBe(true);
    });

    it('returns graceful mock fallback when recruitment endpoint returns 404', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: { status: 404 },
      });

      const res = await selfReportResignation('app-1', {
        resignationDate: '2026-11-12',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('Đã cập nhật trạng thái nghỉ việc thành công.');
    });

    it('throws formatted error on other errors', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce({
        response: { status: 500, data: { message: 'Lỗi máy chủ' } },
      });

      await expect(
        selfReportResignation('app-1', {
          resignationDate: '2026-11-12',
        })
      ).rejects.toThrow('Lỗi máy chủ');
    });

    it('calls via placementApi wrapper', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true },
      } as any);

      const res = await placementApi.selfReportResignation('app-1', {
        resignationDate: '2026-11-12',
      });
      expect(res.success).toBe(true);
    });
  });
});
