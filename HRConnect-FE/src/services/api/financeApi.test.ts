/**
 * @file services/api/financeApi.test.ts
 * @description Unit tests for financeApi (Replacement slots, warranties, resignations).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { financeApi } from './financeApi';
import type { ReplacementSlotDto, WarrantyClaimResponse } from '@/types/api/finance';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('financeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReplacementSlots', () => {
    it('calls GET /jobs/{jobId}/replacement-slots and unwraps data', async () => {
      const mockSlots: ReplacementSlotDto[] = [
        {
          replacementSlotId: 'slot-1',
          jobId: 'job-1',
          status: 'OPEN',
          originalPlacementId: 'pl-1',
          originalCandidateName: 'Nguyễn Văn A',
          serviceFeeId: 'fee-1',
          fillWindowDays: 30,
          openedAt: '2026-10-10T00:00:00Z',
          expiresAt: '2026-11-09T00:00:00Z',
          filledByPlacementId: null,
          replacementCandidateName: null,
          closedAt: null,
          cancelReason: null,
          concurrencyToken: 'token-1',
          createdAt: '2026-10-10T00:00:00Z',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockSlots },
      });

      const res = await financeApi.getReplacementSlots('job-1');
      expect(apiClient.get).toHaveBeenCalledWith('/jobs/job-1/replacement-slots');
      expect(res).toEqual(mockSlots);
    });

    it('returns empty array when data is null or empty', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: null },
      });

      const res = await financeApi.getReplacementSlots('job-1');
      expect(res).toEqual([]);
    });
  });

  describe('cancelReplacementSlot', () => {
    it('calls POST /internal/replacement-slots/{id}/cancel with payload', async () => {
      const cancelledSlot: ReplacementSlotDto = {
        replacementSlotId: 'slot-1',
        jobId: 'job-1',
        status: 'CANCELLED',
        originalPlacementId: 'pl-1',
        originalCandidateName: 'Nguyễn Văn A',
        serviceFeeId: 'fee-1',
        fillWindowDays: 30,
        openedAt: '2026-10-10T00:00:00Z',
        expiresAt: '2026-11-09T00:00:00Z',
        filledByPlacementId: null,
        replacementCandidateName: null,
        closedAt: '2026-10-16T12:00:00Z',
        cancelReason: 'Doanh nghiệp đã hủy vị trí này',
        concurrencyToken: 'token-2',
        createdAt: '2026-10-10T00:00:00Z',
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, data: cancelledSlot },
      });

      const res = await financeApi.cancelReplacementSlot('slot-1', {
        reason: 'Doanh nghiệp đã hủy vị trí này',
        concurrencyToken: 'token-1',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/internal/replacement-slots/slot-1/cancel', {
        reason: 'Doanh nghiệp đã hủy vị trí này',
        concurrencyToken: 'token-1',
      });
      expect(res).toEqual(cancelledSlot);
    });
  });

  describe('resolveResignation', () => {
    it('calls POST /placements/{id}/resignation/resolve and returns claim response with replacement info', async () => {
      const claimResponse: WarrantyClaimResponse = {
        placementId: 'pl-1',
        warrantyStatus: 'VOIDED',
        placementStatus: 'RESIGNED',
        commissions: [{ commissionId: 'c-1', status: 'CANCELLED' }],
        replacement: {
          replacementSlotId: 'slot-new',
          jobId: 'job-1',
          status: 'OPEN',
          expiresAt: '2026-11-15T00:00:00Z',
        },
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, data: claimResponse },
      });

      const res = await financeApi.resolveResignation('pl-1', {
        confirmed: true,
        note: 'Đã xác minh ứng viên nghỉ việc',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/placements/pl-1/resignation/resolve', {
        confirmed: true,
        note: 'Đã xác minh ứng viên nghỉ việc',
      });
      expect(res).toEqual(claimResponse);
    });
  });

  describe('getPlacements', () => {
    it('calls GET /placements with cleaned params', async () => {
      const mockResult = {
        items: [
          {
            placementId: 'pl-1',
            applicationId: 'app-1',
            offerId: 'off-1',
            actualStartDate: '2026-10-01',
            position: 'Senior Backend Engineer',
            department: 'Tech',
            status: 'CONFIRMED',
            candidate: {
              candidateId: 'cand-1',
              fullName: 'Nguyễn Văn A',
              email: 'a@example.com',
            },
            job: {
              jobId: 'job-1',
              title: 'Senior Backend Engineer',
              companyId: 'comp-1',
              companyName: 'Tech Corp',
            },
          },
        ],
        totalCount: 1,
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockResult,
      });

      const res = await financeApi.getPlacements({ jobId: 'job-1', page: 1, pageSize: 20 });
      expect(apiClient.get).toHaveBeenCalledWith('/placements', {
        params: { jobId: 'job-1', page: 1, pageSize: 20 },
      });
      expect(res).toEqual(mockResult);
    });
  });
});
