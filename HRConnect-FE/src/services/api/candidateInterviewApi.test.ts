import { describe, it, expect, vi, beforeEach } from 'vitest';
import { candidateInterviewApi } from './candidateInterviewApi';
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

describe('candidateInterviewApi', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('getInterviewDetail', () => {
    it('calls GET /interviews/{interviewId} and returns formatted detail data', async () => {
      const mockRawData = {
        interviewId: 'iv-123',
        applicationId: 'app-456',
        jobId: 'job-789',
        jobTitle: 'Senior React Developer',
        companyId: 'comp-101',
        companyName: 'Tech Innovations JSC',
        candidateEmail: 'nguyenvana@example.com',
        candidatePhone: '0901234567',
        interviewRound: 1,
        interviewType: 'ONLINE',
        scheduledAt: '2026-10-25T09:00:00Z',
        durationMinutes: 45,
        location: 'Tòa nhà Landmark 81, TP. HCM',
        meetingLink: 'https://meet.google.com/xyz-abc-def',
        status: 'SCHEDULED',
        feedback: 'Nội dung đánh giá nội bộ',
        concurrencyToken: 'private-token',
        participants: [{ userId: 'u-1', name: 'Trần Thị B', role: 'Interviewer' }],
        statusHistories: [
          {
            interviewStatusHistoryId: 'hist-1',
            oldStatus: null,
            newStatus: 'SCHEDULED',
            newScheduledAt: '2026-10-25T09:00:00Z',
            changedAt: '2026-10-18T10:00:00Z',
          },
        ],
        createdAt: '2026-10-18T10:00:00Z',
        updatedAt: '2026-10-18T10:00:00Z',
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Lấy chi tiết lịch phỏng vấn thành công.',
          data: mockRawData,
        },
      } as any);

      const result = await candidateInterviewApi.getInterviewDetail('iv-123');

      expect(apiClient.get).toHaveBeenCalledWith('/interviews/iv-123');
      expect(result.interviewId).toBe('iv-123');
      expect(result.jobTitle).toBe('Senior React Developer');
      expect(result.companyName).toBe('Tech Innovations JSC');
      expect(result.meetingLink).toBe('https://meet.google.com/xyz-abc-def');
      expect(result.status).toBe('SCHEDULED');
      expect(result.interviewRound).toBe(1);
      expect(result.statusHistories).toHaveLength(1);
      expect(result).not.toHaveProperty('participants');
      expect(result).not.toHaveProperty('feedback');
      expect(result).not.toHaveProperty('concurrencyToken');
    });

    it('unwraps direct response without nested data envelope', async () => {
      const mockRawData = {
        interviewId: 'iv-direct',
        jobTitle: 'Backend Go Engineer',
        companyName: 'Cloud Corp',
        interviewRound: 2,
        interviewType: 'OFFLINE',
        location: '72 Lê Thánh Tôn, Q.1, TP.HCM',
        status: 'SCHEDULED',
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockRawData,
      } as any);

      const result = await candidateInterviewApi.getInterviewDetail('iv-direct');
      expect(result.interviewId).toBe('iv-direct');
      expect(result.jobTitle).toBe('Backend Go Engineer');
      expect(result.interviewType).toBe('OFFLINE');
      expect(result.location).toBe('72 Lê Thánh Tôn, Q.1, TP.HCM');
    });

    it('throws error when data is invalid or call fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network Error'));

      await expect(candidateInterviewApi.getInterviewDetail('iv-err')).rejects.toThrow(
        'Network Error'
      );
    });
  });

});
