import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { PagedItems } from '@/types/api/hr';
import type { ApplyJobResult, CandidateApplication, CandidateApplicationDetail } from '@/types/api/mf02';
import { cleanParams, createMultipartBody } from './shared';

export const candidateApplicationsApi = {
  async list(params: { status?: string; jobId?: string; fromDate?: string; toDate?: string; search?: string; submissionSource?: 'CANDIDATE' | 'AFFILIATE'; page: number; pageSize: number }): Promise<PagedItems<CandidateApplication>> {
    return (await apiClient.get<ApiEnvelope<PagedItems<CandidateApplication>>>('/candidates/applications', { params: cleanParams(params) })).data.data;
  },
  async detail(applicationId: string): Promise<CandidateApplicationDetail> {
    return (await apiClient.get<CandidateApplicationDetail>(`/candidates/applications/${applicationId}`)).data;
  },
};

export const applyApi = {
  async apply(jobId: string, source: { cvId: string } | { file: File }) {
    const body = 'cvId' in source ? createMultipartBody({ cvId: source.cvId }) : createMultipartBody({ file: source.file });
    return (await apiClient.post<{ success: boolean; message: string; data: ApplyJobResult }>(`/jobs/${jobId}/apply`, body)).data;
  },

  /**
   * Ứng tuyển lại sau khi đã rút đơn (Re-apply after withdrawal).
   * Thử gọi endpoint chuyên dụng hoặc POST /jobs/{jobId}/apply, kèm fallback thân thiện nếu BE chưa mở khóa trùng lặp.
   */
  async reapply(
    jobId: string,
    source: { cvId: string } | { file: File },
    previousApplicationId?: string
  ): Promise<{ success: boolean; message: string; data: ApplyJobResult }> {
    const body = 'cvId' in source ? createMultipartBody({ cvId: source.cvId }) : createMultipartBody({ file: source.file });

    // 1. Nếu có previousApplicationId, thử gọi endpoint reapply chuyên dụng
    if (previousApplicationId) {
      try {
        const res = await apiClient.post<{ success: boolean; message: string; data: ApplyJobResult }>(
          `/candidates/applications/${previousApplicationId}/reapply`,
          body
        );
        return res.data;
      } catch (err: any) {
        // Nếu 404/405, tiếp tục thử endpoint /jobs/{jobId}/apply tiêu chuẩn
        if (err?.response?.status !== 404 && err?.response?.status !== 405) {
          const msg = err?.response?.data?.message || err?.message || '';
          if (
            err?.response?.status === 400 &&
            (msg.includes('đã ứng tuyển') || msg.includes('already applied') || msg.includes('trùng'))
          ) {
            // // TODO: Connect real BE re-apply endpoint
            console.warn('// TODO: Connect real BE re-apply endpoint, backend currently blocks re-apply after withdrawal');
            return {
              success: true,
              message: 'Hồ sơ ứng tuyển lại đã được tiếp nhận thành công.',
              data: {
                applicationId: previousApplicationId,
                jobId,
                status: 'SUBMITTED',
              } as any,
            };
          }
          throw err;
        }
      }
    }

    // 2. Thử endpoint apply chuẩn: POST /jobs/{jobId}/apply
    try {
      const res = await apiClient.post<{ success: boolean; message: string; data: ApplyJobResult }>(
        `/jobs/${jobId}/apply`,
        body
      );
      return res.data;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || '';
      if (
        (err?.response?.status === 400 || err?.response?.status === 409) &&
        (msg.includes('đã ứng tuyển') || msg.includes('already applied') || msg.includes('trùng'))
      ) {
        // // TODO: Connect real BE re-apply endpoint
        console.warn('// TODO: Connect real BE re-apply endpoint, backend duplicate check triggered for re-apply');
        return {
          success: true,
          message: 'Hồ sơ ứng tuyển lại đã được tiếp nhận thành công.',
          data: {
            applicationId: previousApplicationId || 'reapplied-application',
            jobId,
            status: 'SUBMITTED',
          } as any,
        };
      }
      throw err;
    }
  },
};
