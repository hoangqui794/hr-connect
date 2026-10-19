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

      // Keep this projection intentionally narrow for candidates. The backend applies the
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
        candidateFullName: rawData.candidateFullName ?? rawData.candidateName ?? '',
        candidateName: rawData.candidateFullName ?? rawData.candidateName ?? '',
        createdAt: rawData.createdAt ?? '',
        updatedAt: rawData.updatedAt ?? '',
        statusHistories: Array.isArray(rawData.statusHistories)
          ? rawData.statusHistories.map((history: any) => ({
              interviewStatusHistoryId: history.interviewStatusHistoryId ?? '',
              oldStatus: history.oldStatus ?? null,
              newStatus: history.newStatus ?? '',
              oldScheduledAt: history.oldScheduledAt ?? null,
              newScheduledAt: history.newScheduledAt ?? null,
              reason: history.reason ?? null,
              changedAt: history.changedAt ?? '',
            }))
          : [],
      };

      return detail;
    } catch (err: any) {
      throw getApiError(err, 'Không thể tải chi tiết lịch phỏng vấn');
    }
  },

  /**
   * GET /api/v1/interviews/{interviewId}
   * Full details for Client / Staff workspace (including feedback, concurrency token, participants, candidate details).
   */
  async getClientInterviewDetail(interviewId: string): Promise<CandidateInterviewDetailDto> {
    try {
      const response = await apiClient.get<any>(`/interviews/${interviewId}`);
      const rawData = response.data?.data ?? response.data;
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Dữ liệu phỏng vấn không hợp lệ');
      }

      return {
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
        candidateName: rawData.candidateFullName ?? rawData.candidateName ?? '',
        candidateFullName: rawData.candidateFullName ?? rawData.candidateName ?? '',
        candidateEmail: rawData.candidateEmail ?? null,
        candidatePhone: rawData.candidatePhone ?? null,
        result: rawData.result ?? null,
        feedback: rawData.feedback ?? null,
        concurrencyToken: rawData.concurrencyToken ?? '',
        createdByName: rawData.createdByName ?? null,
        recordedByName: rawData.recordedByName ?? null,
        recordedAt: rawData.recordedAt ?? null,
        participants: Array.isArray(rawData.participants) ? rawData.participants : [],
        createdAt: rawData.createdAt ?? '',
        updatedAt: rawData.updatedAt ?? '',
        statusHistories: Array.isArray(rawData.statusHistories)
          ? rawData.statusHistories.map((history: any) => ({
              interviewStatusHistoryId: history.interviewStatusHistoryId ?? '',
              oldStatus: history.oldStatus ?? null,
              newStatus: history.newStatus ?? '',
              oldScheduledAt: history.oldScheduledAt ?? null,
              newScheduledAt: history.newScheduledAt ?? null,
              reason: history.reason ?? null,
              changedAt: history.changedAt ?? '',
            }))
          : [],
      };
    } catch (err: any) {
      throw getApiError(err, 'Không thể tải chi tiết lịch phỏng vấn');
    }
  },

};

export default candidateInterviewApi;
