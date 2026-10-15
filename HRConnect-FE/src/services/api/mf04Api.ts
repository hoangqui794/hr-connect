/**
 * @file mf04Api.ts
 * @description API client service for MF-04 Candidate Profile & Recruitment Lifecycle.
 */

import { apiClient } from '../apiClient';
import type {
  CandidateProfileData,
  CandidateProfileResponse,
  UpdateCandidateProfileCommand,
  UpdateProfileVisibilityCommand,
  CandidateRecruitmentApplicationDetailDto,
  ApplicationTimelineData,
  ApplicationCvDownloadUrlData,
  WithdrawApplicationRequest,
  RespondOfferRequest,
  CandidateInterviewSummaryDto,
  CandidateOfferSummaryDto,
} from '@/types/api/mf04';

export const mf04Api = {
  /**
   * GET /api/v1/candidates/profile/me
   * Lấy thông tin hồ sơ ứng viên đang đăng nhập trực tiếp từ database.
   */
  async getProfile(): Promise<CandidateProfileData> {
    const response = await apiClient.get<CandidateProfileResponse>('/candidates/profile/me');
    if (!response.data?.data) {
      throw new Error(response.data?.message || 'Không tìm thấy thông tin hồ sơ.');
    }
    return response.data.data;
  },

  /**
   * PUT /api/v1/candidates/profile/me
   * Cập nhật thông tin hồ sơ và 9 trường nghề nghiệp vào database.
   */
  async updateProfile(command: UpdateCandidateProfileCommand): Promise<CandidateProfileData> {
    const response = await apiClient.put<CandidateProfileResponse>('/candidates/profile/me', command);
    if (!response.data?.data) {
      throw new Error(response.data?.message || 'Cập nhật hồ sơ thất bại.');
    }
    return response.data.data;
  },

  /**
   * PATCH /api/v1/candidates/profile/me/visibility
   * Cập nhật chế độ hiển thị hồ sơ (PUBLIC/PRIVATE).
   */
  async updateVisibility(command: UpdateProfileVisibilityCommand): Promise<{ success: boolean; message?: string }> {
    const response = await apiClient.patch<{ success: boolean; message?: string }>(
      '/candidates/profile/me/visibility',
      command
    );
    return response.data;
  },

  /**
   * GET /api/v1/recruitment/applications/:id
   * Lấy chi tiết đơn tuyển dụng của ứng viên (có concurrencyToken và allowedActions).
   */
  async getApplicationDetail(applicationId: string): Promise<CandidateRecruitmentApplicationDetailDto> {
    const response = await apiClient.get<{
      success: boolean;
      message: string;
      data: CandidateRecruitmentApplicationDetailDto;
    }>(`/recruitment/applications/${applicationId}`);
    return response.data.data;
  },

  /**
   * GET /api/v1/recruitment/applications/:id/timeline
   * Lấy lịch sử dòng thời gian công khai của đơn ứng tuyển (đã lọc dữ liệu nội bộ).
   */
  async getApplicationTimeline(applicationId: string): Promise<ApplicationTimelineData> {
    const response = await apiClient.get<{
      success: boolean;
      message: string;
      data: ApplicationTimelineData;
    }>(`/recruitment/applications/${applicationId}/timeline`);
    return response.data.data;
  },

  /**
   * GET /api/v1/recruitment/applications/:id/cv/download-url
   * Lấy signed URL ngắn hạn để tải CV chính xác đã nộp theo đơn ứng tuyển.
   */
  async getApplicationCvDownloadUrl(applicationId: string): Promise<ApplicationCvDownloadUrlData> {
    const response = await apiClient.get<{
      success: boolean;
      message: string;
      data: ApplicationCvDownloadUrlData;
    }>(`/recruitment/applications/${applicationId}/cv/download-url`);
    return response.data.data;
  },

  /**
   * POST /api/v1/recruitment/applications/:id/withdraw
   * Rút đơn ứng tuyển kèm reason và concurrencyToken.
   */
  async withdrawApplication(
    applicationId: string,
    payload: WithdrawApplicationRequest
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/recruitment/applications/${applicationId}/withdraw`,
      payload
    );
    return response.data;
  },

  /**
   * GET /api/v1/recruitment/interviews
   * Lấy danh sách lịch phỏng vấn (scoped cho ứng viên hiện tại).
   */
  async getInterviews(params?: {
    applicationId?: string;
    sortDirection?: 'ASC' | 'DESC' | string;
    status?: string;
  }): Promise<CandidateInterviewSummaryDto[]> {
    const response = await apiClient.get<{
      success: boolean;
      message: string;
      data: { items: any[] };
    }>('/recruitment/interviews', { params });
    const items = response.data?.data?.items || [];
    return items.map((i) => ({
      interviewId: i.interviewId,
      interviewRound: i.interviewRound,
      interviewType: i.interviewType,
      scheduledAt: i.scheduledAt,
      durationMinutes: i.durationMinutes,
      location: i.location,
      meetingLink: i.meetingLink,
      status: i.status,
      concurrencyToken: i.concurrencyToken,
    }));
  },

  /**
   * GET /api/v1/recruitment/offers
   * Lấy danh sách lời mời nhận việc (scoped cho ứng viên hiện tại).
   */
  async getOffers(params?: {
    applicationId?: string;
    status?: string;
  }): Promise<CandidateOfferSummaryDto[]> {
    const response = await apiClient.get<{
      success: boolean;
      message: string;
      data: { items: any[] };
    }>('/recruitment/offers', { params });
    const items = response.data?.data?.items || [];
    return items.map((o) => ({
      offerId: o.offerId,
      offerVersion: o.offerVersion,
      salary: o.salary,
      currencyCode: o.currencyCode || 'VND',
      startDate: o.startDate,
      expiryDate: o.expiryDate,
      status: o.status,
      offerDocumentUrl: o.offerDocumentUrl,
      sentAt: o.sentAt,
      respondedAt: o.respondedAt,
      declineReason: o.declineReason,
      concurrencyToken: o.concurrencyToken,
      canRespond: Boolean(o.canRespond),
    }));
  },

  /**
   * POST /api/v1/recruitment/offers/:id/respond
   * Phản hồi lời mời nhận việc (Accepted / Declined kèm reason và concurrencyToken).
   */
  async respondOffer(
    offerId: string,
    payload: RespondOfferRequest
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/recruitment/offers/${offerId}/respond`,
      payload
    );
    return response.data;
  },
};
