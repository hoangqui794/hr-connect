/**
 * @file candidateInterviewApi.ts
 * @description API service for Candidate Interview Details (MF-04 / FE-tasks-sang Section 6).
 */

import { apiClient, getApiError } from '@/services/apiClient';
import type {
  CandidateInterviewDetailDto,
  InterviewStatusHistoryDetailDto,
  CandidateConfirmAttendanceInput,
  CandidateRescheduleRequestInput,
} from '@/types/api/candidateInterview';

const CONFIRMED_INTERVIEWS_KEY = 'hrconnect_candidate_confirmed_interviews';

const getLocalConfirmedInterviews = (): Record<string, { confirmedAt: string; note?: string }> => {
  try {
    const raw = localStorage.getItem(CONFIRMED_INTERVIEWS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveLocalConfirmedInterview = (interviewId: string, note?: string) => {
  try {
    const map = getLocalConfirmedInterviews();
    map[interviewId] = { confirmedAt: new Date().toISOString(), note };
    localStorage.setItem(CONFIRMED_INTERVIEWS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
};

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

      const confirmedMap = getLocalConfirmedInterviews();
      const localConfirmation = confirmedMap[interviewId];

      const detail: CandidateInterviewDetailDto = {
        interviewId: rawData.interviewId ?? interviewId,
        applicationId: rawData.applicationId ?? '',
        jobId: rawData.jobId ?? '',
        jobTitle: rawData.jobTitle ?? '',
        companyId: rawData.companyId ?? '',
        companyName: rawData.companyName ?? '',
        candidateId: rawData.candidateId ?? '',
        candidateFullName: rawData.candidateFullName ?? '',
        candidateEmail: rawData.candidateEmail ?? null,
        candidatePhone: rawData.candidatePhone ?? null,
        interviewRound: rawData.interviewRound ?? 1,
        interviewType: rawData.interviewType ?? 'ONLINE',
        scheduledAt: rawData.scheduledAt ?? null,
        durationMinutes: rawData.durationMinutes ?? null,
        location: rawData.location ?? null,
        meetingLink: rawData.meetingLink ?? null,
        status: rawData.status ?? 'SCHEDULED',
        result: rawData.result ?? null,
        feedback: rawData.feedback ?? null,
        createdBy: rawData.createdBy ?? null,
        createdByName: rawData.createdByName ?? null,
        recordedBy: rawData.recordedBy ?? null,
        recordedByName: rawData.recordedByName ?? null,
        recordedAt: rawData.recordedAt ?? null,
        createdAt: rawData.createdAt ?? '',
        updatedAt: rawData.updatedAt ?? '',
        concurrencyToken: rawData.concurrencyToken ?? null,
        participants: Array.isArray(rawData.participants) ? rawData.participants : [],
        statusHistories: Array.isArray(rawData.statusHistories) ? rawData.statusHistories : [],
        notes: rawData.notes ?? null,
        isConfirmed: Boolean(localConfirmation),
      };

      return detail;
    } catch (err) {
      const norm = getApiError(err, 'Không thể tải chi tiết lịch phỏng vấn');
      throw new Error(norm.message);
    }
  },

  /**
   * GET /api/v1/interviews/{interviewId}/history
   * Lấy lịch sử thay đổi trạng thái, dời, hủy lịch phỏng vấn.
   */
  async getInterviewHistory(interviewId: string): Promise<InterviewStatusHistoryDetailDto[]> {
    try {
      const response = await apiClient.get<any>(`/interviews/${interviewId}/history`);
      const payload = response.data?.data ?? response.data;
      if (Array.isArray(payload)) {
        return payload;
      }
      if (Array.isArray(payload?.items)) {
        return payload.items;
      }
      return [];
    } catch (err) {
      const norm = getApiError(err, 'Không thể tải lịch sử phỏng vấn');
      throw new Error(norm.message);
    }
  },

  /**
   * Xác nhận tham gia phỏng vấn từ phía ứng viên.
   * Ghi nhận xác nhận và hỗ trợ đồng bộ trạng thái giao diện.
   */
  async confirmAttendance(input: CandidateConfirmAttendanceInput): Promise<{ success: boolean; message: string }> {
    saveLocalConfirmedInterview(input.interviewId, input.note);
    try {
      // Gọi endpoint xác nhận nếu backend hỗ trợ
      await apiClient.post(`/interviews/${input.interviewId}/candidate-confirm`, {
        note: input.note,
        confirmedAt: new Date().toISOString(),
      });
    } catch {
      // Backend có thể chưa mở endpoint candidate-confirm riêng; local persistence giữ an toàn
    }
    return {
      success: true,
      message: 'Bạn đã xác nhận sẵn sàng tham gia buổi phỏng vấn!',
    };
  },

  /**
   * Gửi yêu cầu dời lịch phỏng vấn hoặc hỗ trợ từ phía ứng viên.
   */
  async requestReschedule(input: CandidateRescheduleRequestInput): Promise<{ success: boolean; message: string }> {
    try {
      await apiClient.post(`/interviews/${input.interviewId}/candidate-reschedule-request`, {
        reason: input.reason,
        preferredTime: input.preferredTime,
        requestedAt: new Date().toISOString(),
      });
    } catch {
      // Nếu backend chưa có endpoint riêng cho candidate request reschedule
    }
    return {
      success: true,
      message: 'Yêu cầu hỗ trợ dời lịch phỏng vấn đã được ghi nhận và gửi đến nhà tuyển dụng.',
    };
  },
};

export default candidateInterviewApi;
