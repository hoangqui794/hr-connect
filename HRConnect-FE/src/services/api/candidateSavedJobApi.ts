/**
 * @file candidateSavedJobApi.ts
 * @description API client for Candidate Saved Jobs (GET /candidates/me/saved-jobs, POST /candidates/me/saved-jobs/{jobId}, DELETE /candidates/me/saved-jobs/{jobId}).
 * Supporting pagination and idempotent save/unsave actions.
 */

import { apiClient } from '../apiClient';
import type {
  SavedJobPageDto,
  SaveJobResponse,
  SavedJobQueryParams,
} from '@/types/api/candidateSavedJobs';

const cleanParams = (params?: SavedJobQueryParams): Record<string, unknown> => {
  if (!params) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

const extractData = <T>(resData: any): T => {
  if (resData && typeof resData === 'object' && 'data' in resData && resData.data !== undefined) {
    return resData.data as T;
  }
  return resData as T;
};

export const candidateSavedJobApi = {
  /**
   * GET /api/v1/candidates/me/saved-jobs
   * Lấy danh sách việc làm đã lưu của Candidate (hỗ trợ phân trang page, pageSize).
   */
  async getSavedJobs(params?: SavedJobQueryParams): Promise<SavedJobPageDto> {
    const cleaned = cleanParams(params);
    try {
      const res = await apiClient.get<SavedJobPageDto | { success: boolean; data: SavedJobPageDto }>(
        '/candidates/me/saved-jobs',
        { params: cleaned }
      );
      return extractData<SavedJobPageDto>(res.data);
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const fallbackRes = await apiClient.get<SavedJobPageDto | { success: boolean; data: SavedJobPageDto }>(
          '/candidate/saved-jobs',
          { params: cleaned }
        );
        return extractData<SavedJobPageDto>(fallbackRes.data);
      }
      throw err;
    }
  },

  /**
   * POST /api/v1/candidates/me/saved-jobs/{jobId}
   * Lưu tin tuyển dụng vào danh sách quan tâm (Idempotent).
   */
  async saveJob(jobId: string): Promise<SaveJobResponse> {
    const encodedId = encodeURIComponent(jobId);
    try {
      const res = await apiClient.post<SaveJobResponse | { success: boolean; data: SaveJobResponse }>(
        `/candidates/me/saved-jobs/${encodedId}`
      );
      return extractData<SaveJobResponse>(res.data) ?? { success: true, message: 'Đã lưu việc làm thành công.' };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const fallbackRes = await apiClient.post<SaveJobResponse | { success: boolean; data: SaveJobResponse }>(
          `/candidate/saved-jobs/${encodedId}`
        );
        return extractData<SaveJobResponse>(fallbackRes.data) ?? { success: true, message: 'Đã lưu việc làm thành công.' };
      }
      throw err;
    }
  },

  /**
   * DELETE /api/v1/candidates/me/saved-jobs/{jobId}
   * Bỏ lưu tin tuyển dụng khỏi danh sách quan tâm (Idempotent).
   */
  async unsaveJob(jobId: string): Promise<SaveJobResponse> {
    const encodedId = encodeURIComponent(jobId);
    try {
      const res = await apiClient.delete<SaveJobResponse | { success: boolean; data: SaveJobResponse }>(
        `/candidates/me/saved-jobs/${encodedId}`
      );
      return extractData<SaveJobResponse>(res.data) ?? { success: true, message: 'Đã hủy lưu việc làm thành công.' };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const fallbackRes = await apiClient.delete<SaveJobResponse | { success: boolean; data: SaveJobResponse }>(
          `/candidate/saved-jobs/${encodedId}`
        );
        return extractData<SaveJobResponse>(fallbackRes.data) ?? { success: true, message: 'Đã hủy lưu việc làm thành công.' };
      }
      throw err;
    }
  },
};
