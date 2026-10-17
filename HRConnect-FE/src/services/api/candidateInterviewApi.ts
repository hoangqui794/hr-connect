/**
 * @file candidateInterviewApi.ts
 * @description API service for Candidate Interview Details (MF-04 / FE-tasks-sang Section 6).
 */

import { apiClient, getApiError } from '@/services/apiClient';
import type {
  CandidateInterviewDetailDto,
} from '@/types/api/candidateInterview';

export const candidateInterviewApi = {
  /**
   * GET /api/v1/interviews/{interviewId}
   * Lấy chi tiết lịch phỏng vấn (cho ứng viên hoặc người có quyền).
   */
  async getInterviewDetail(interviewId: string): Promise<CandidateInterviewDetailDto> {
    try {
      const response = await apiClient.get<any>(`/interviews/${interviewId}`);
      const rawData = response.data?.data ?? response.data;
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Dữ liệu phỏng vấn không hợp lệ');
      }

      // Keep this projection intentionally narrow. The backend applies the
      // authorization boundary, while this client avoids retaining or
      // rendering staff-only fields should a response shape change later.
      const detail: CandidateInterviewDetailDto = {
        interviewId: rawData.interviewId ?? interviewId,
        applicationId: rawData.applicationId ?? '',
        jobId: rawData.jobId ?? '',
        jobTitle: rawData.jobTitle ?? '',
        companyId: rawData.companyId ?? '',
        companyName: rawData.companyName ?? '',
        interviewRound: rawData.interviewRound ?? 1,
        interviewType: rawData.interviewType ?? 'ONLINE',
        scheduledAt: rawData.scheduledAt ?? null,
        durationMinutes: rawData.durationMinutes ?? null,
        location: rawData.location ?? null,
        meetingLink: rawData.meetingLink ?? null,
        status: rawData.status ?? 'SCHEDULED',
        createdAt: rawData.createdAt ?? '',
        updatedAt: rawData.updatedAt ?? '',
        statusHistories: Array.isArray(rawData.statusHistories)
          ? rawData.statusHistories.map((history: any) => ({
              interviewStatusHistoryId: history.interviewStatusHistoryId ?? '',
              oldStatus: history.oldStatus ?? null,
              newStatus: history.newStatus ?? '',
              oldScheduledAt: history.oldScheduledAt ?? null,
              newScheduledAt: history.newScheduledAt ?? null,
              changedAt: history.changedAt ?? '',
            }))
          : [],
      };

      return detail;
    } catch (err) {
      const norm = getApiError(err, 'Không thể tải chi tiết lịch phỏng vấn');
      throw new Error(norm.message);
    }
  },

};

export default candidateInterviewApi;
