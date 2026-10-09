import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { PagedItems } from '@/types/api/hr';
import type { ApplyJobResult, CandidateApplication, CandidateApplicationDetail } from '@/types/api/mf02';
import { cleanParams, createMultipartBody } from './shared';

export const candidateApplicationsApi = {
  async list(params: { status?: string; jobId?: string; fromDate?: string; toDate?: string; page: number; pageSize: number }): Promise<PagedItems<CandidateApplication>> {
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
};
