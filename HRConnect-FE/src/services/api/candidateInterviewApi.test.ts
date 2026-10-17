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
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('getInterviewDetail', () => {
    it('calls GET /interviews/{interviewId} and returns formatted detail data', async () => {
      const mockRawData = {
        interviewId: 'iv-123',
        applicationId: 'app-456',
        jobId: 'job-789',
        jobTitle: 'Senior React Developer',
        companyId: 'comp-101',
        companyName: 'Tech Innovations JSC',
        candidateId: 'cand-202',
        candidateFullName: 'Nguyễn Văn A',
        candidateEmail: 'nguyenvana@example.com',
        candidatePhone: '0901234567',
        interviewRound: 1,
        interviewType: 'ONLINE',
        scheduledAt: '2026-10-25T09:00:00Z',
        durationMinutes: 45,
        location: 'Tòa nhà Landmark 81, TP. HCM',
        meetingLink: 'https://meet.google.com/xyz-abc-def',
        status: 'SCHEDULED',
        participants: [
          { userId: 'u-1', name: 'Trần Thị B', role: 'Interviewer' },
        ],
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
      expect(result.participants).toHaveLength(1);
      expect(result.statusHistories).toHaveLength(1);
      expect(result.isConfirmed).toBe(false);
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

  describe('getInterviewHistory', () => {
    it('calls GET /interviews/{interviewId}/history and returns list of history items', async () => {
      const mockHistories = [
        {
          interviewStatusHistoryId: 'h-1',
          oldStatus: 'SCHEDULED',
          newStatus: 'RESCHEDULED',
          oldScheduledAt: '2026-10-20T09:00:00Z',
          newScheduledAt: '2026-10-22T09:00:00Z',
          changedAt: '2026-10-19T08:00:00Z',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockHistories,
        },
      } as any);

      const histories = await candidateInterviewApi.getInterviewHistory('iv-123');

      expect(apiClient.get).toHaveBeenCalledWith('/interviews/iv-123/history');
      expect(histories).toEqual(mockHistories);
    });
  });

  describe('confirmAttendance', () => {
    it('records confirmation and returns success response', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } } as any);

      const res = await candidateInterviewApi.confirmAttendance({
        interviewId: 'iv-123',
        note: 'Tôi sẽ tham gia đúng giờ',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('xác nhận');

      // Subsequent getInterviewDetail will mark isConfirmed as true
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          interviewId: 'iv-123',
          jobTitle: 'Frontend Engineer',
          status: 'SCHEDULED',
        },
      } as any);

      const detail = await candidateInterviewApi.getInterviewDetail('iv-123');
      expect(detail.isConfirmed).toBe(true);
    });
  });

  describe('requestReschedule', () => {
    it('submits reschedule request and returns success message', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } } as any);

      const res = await candidateInterviewApi.requestReschedule({
        interviewId: 'iv-123',
        reason: 'Bận công tác đột xuất',
        preferredTime: '2026-10-28T14:00:00Z',
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain('dời lịch');
    });
  });
});
