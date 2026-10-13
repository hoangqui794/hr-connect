import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { mf04Api } from './mf04Api';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('mf04Api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Candidate Profile', () => {
    it('getProfile calls /candidates/profile/me and returns data', async () => {
      const mockProfile = {
        candidateId: 'cand-1',
        fullName: 'Nguyễn Văn A',
        currentJobTitle: 'Senior React Developer',
        targetRole: 'Frontend Lead',
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockProfile },
      });

      const result = await mf04Api.getProfile();
      expect(apiClient.get).toHaveBeenCalledWith('/candidates/profile/me');
      expect(result).toEqual(mockProfile);
    });

    it('updateProfile calls PUT /candidates/profile/me with 9 career fields', async () => {
      const command = {
        fullName: 'Nguyễn Văn A',
        currentJobTitle: 'Senior React Developer',
        currentLevel: 'Senior',
        targetRole: 'Frontend Lead',
        expectedSalaryMin: 30000000,
        expectedSalaryMax: 50000000,
        expectedSalaryCurrency: 'VND',
        availableFrom: '2026-11-01',
        preferredLocations: ['Hà Nội', 'Remote'],
        preferredWorkModes: ['Hybrid', 'Remote'],
      };
      vi.mocked(apiClient.put).mockResolvedValueOnce({
        data: { success: true, data: { candidateId: 'cand-1', ...command } },
      });

      const result = await mf04Api.updateProfile(command);
      expect(apiClient.put).toHaveBeenCalledWith('/candidates/profile/me', command);
      expect(result.currentJobTitle).toBe('Senior React Developer');
    });

    it('updateVisibility calls PATCH /candidates/profile/me/visibility', async () => {
      vi.mocked(apiClient.patch).mockResolvedValueOnce({
        data: { success: true, message: 'Đã cập nhật chế độ hiển thị' },
      });

      const result = await mf04Api.updateVisibility({ visibility: 'PUBLIC' });
      expect(apiClient.patch).toHaveBeenCalledWith('/candidates/profile/me/visibility', {
        visibility: 'PUBLIC',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('Recruitment Application Detail & Lifecycle', () => {
    it('getApplicationDetail calls /recruitment/applications/:id', async () => {
      const mockDetail = {
        applicationId: 'app-1',
        jobId: 'job-1',
        jobTitle: 'Frontend Engineer',
        companyName: 'Tech Corp',
        status: 'INTERVIEWING',
        concurrencyToken: 'token-abc',
        allowedActions: ['WITHDRAW_APPLICATION', 'VIEW_INTERVIEW'],
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockDetail },
      });

      const result = await mf04Api.getApplicationDetail('app-1');
      expect(apiClient.get).toHaveBeenCalledWith('/recruitment/applications/app-1');
      expect(result.concurrencyToken).toBe('token-abc');
      expect(result.allowedActions).toContain('WITHDRAW_APPLICATION');
    });

    it('getApplicationTimeline calls /recruitment/applications/:id/timeline', async () => {
      const mockTimeline = {
        applicationId: 'app-1',
        candidateName: 'Nguyễn Văn A',
        jobTitle: 'Frontend Engineer',
        currentStatus: 'APPLIED',
        events: [
          {
            eventType: 'APPLICATION_SUBMITTED',
            title: 'Hồ sơ đã được nộp',
            timestamp: '2026-10-13T10:00:00Z',
          },
        ],
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockTimeline },
      });

      const result = await mf04Api.getApplicationTimeline('app-1');
      expect(apiClient.get).toHaveBeenCalledWith('/recruitment/applications/app-1/timeline');
      expect(result.events.length).toBe(1);
    });

    it('getApplicationCvDownloadUrl calls /recruitment/applications/:id/cv/download-url', async () => {
      const mockDownload = {
        applicationId: 'app-1',
        cvId: 'cv-1',
        fileName: 'NguyenVanA_CV.pdf',
        mimeType: 'application/pdf',
        downloadUrl: 'https://storage.example.com/signed-url',
        expiresAt: '2026-10-13T11:00:00Z',
      };
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: { success: true, data: mockDownload },
      });

      const result = await mf04Api.getApplicationCvDownloadUrl('app-1');
      expect(apiClient.get).toHaveBeenCalledWith('/recruitment/applications/app-1/cv/download-url');
      expect(result.downloadUrl).toContain('signed-url');
    });

    it('withdrawApplication sends concurrencyToken and reason', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Rút đơn thành công' },
      });

      const result = await mf04Api.withdrawApplication('app-1', {
        reason: 'Đã nhận việc nơi khác',
        concurrencyToken: 'token-123',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/recruitment/applications/app-1/withdraw', {
        reason: 'Đã nhận việc nơi khác',
        concurrencyToken: 'token-123',
      });
      expect(result.success).toBe(true);
    });

    it('getInterviews calls /recruitment/interviews with query params', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [
              {
                interviewId: 'int-1',
                interviewRound: 1,
                interviewType: 'ONLINE',
                status: 'SCHEDULED',
                concurrencyToken: 'int-token-1',
              },
            ],
          },
        },
      });

      const result = await mf04Api.getInterviews({
        applicationId: 'app-1',
        sortDirection: 'ASC',
      });

      expect(apiClient.get).toHaveBeenCalledWith('/recruitment/interviews', {
        params: { applicationId: 'app-1', sortDirection: 'ASC' },
      });
      expect(result.length).toBe(1);
      expect(result[0].interviewRound).toBe(1);
    });

    it('getOffers calls /recruitment/offers and parses canRespond', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            items: [
              {
                offerId: 'off-1',
                offerVersion: 1,
                salary: 40000000,
                status: 'SENT',
                canRespond: true,
                concurrencyToken: 'off-token-1',
              },
            ],
          },
        },
      });

      const result = await mf04Api.getOffers({ applicationId: 'app-1' });
      expect(apiClient.get).toHaveBeenCalledWith('/recruitment/offers', {
        params: { applicationId: 'app-1' },
      });
      expect(result[0].canRespond).toBe(true);
    });

    it('respondOffer sends response, declineReason and concurrencyToken', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        data: { success: true, message: 'Đã phản hồi lời mời nhận việc' },
      });

      const result = await mf04Api.respondOffer('off-1', {
        response: 'DECLINED',
        declineReason: 'Mức lương chưa phù hợp',
        concurrencyToken: 'off-token-1',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/recruitment/offers/off-1/respond', {
        response: 'DECLINED',
        declineReason: 'Mức lương chưa phù hợp',
        concurrencyToken: 'off-token-1',
      });
      expect(result.success).toBe(true);
    });
  });
});
