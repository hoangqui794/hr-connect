import { apiClient } from '../../apiClient';
import type {
  AdminCandidateDuplicateCaseDetail,
  AdminCandidateDuplicateCaseListItem,
  CandidateDuplicateMergePreview,
  CandidateDuplicatePage,
  MyCandidateDuplicateCaseDetail,
  MyCandidateDuplicateCaseListItem,
  ResolveCandidateDuplicateRequest,
  ResolveCandidateDuplicateResult,
} from '@/types/api/mf02/candidateDuplicate';
import { cleanParams } from './shared';

export interface CandidateDuplicateListParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminCandidateDuplicateListParams extends CandidateDuplicateListParams {
  riskLevel?: string;
  jobId?: string;
  companyId?: string;
  createdFrom?: string;
  createdTo?: string;
  search?: string;
}

export const candidateDuplicateApi = {
  async listMine(params: CandidateDuplicateListParams = {}): Promise<CandidateDuplicatePage<MyCandidateDuplicateCaseListItem>> {
    return (
      await apiClient.get<CandidateDuplicatePage<MyCandidateDuplicateCaseListItem>>('/candidates/me/duplicate-cases', {
        params: cleanParams(params),
      })
    ).data;
  },

  async getMine(caseId: string): Promise<MyCandidateDuplicateCaseDetail> {
    return (await apiClient.get<MyCandidateDuplicateCaseDetail>(`/candidates/me/duplicate-cases/${caseId}`)).data;
  },

  async listAdmin(params: AdminCandidateDuplicateListParams = {}): Promise<CandidateDuplicatePage<AdminCandidateDuplicateCaseListItem>> {
    return (
      await apiClient.get<CandidateDuplicatePage<AdminCandidateDuplicateCaseListItem>>('/admin/candidate-duplicate-cases', {
        params: cleanParams(params),
      })
    ).data;
  },

  async getAdmin(caseId: string): Promise<AdminCandidateDuplicateCaseDetail> {
    return (await apiClient.get<AdminCandidateDuplicateCaseDetail>(`/admin/candidate-duplicate-cases/${caseId}`)).data;
  },

  async previewMerge(caseId: string): Promise<CandidateDuplicateMergePreview> {
    return (await apiClient.post<CandidateDuplicateMergePreview>(`/admin/candidate-duplicate-cases/${caseId}/preview-merge`)).data;
  },

  async resolve(caseId: string, body: ResolveCandidateDuplicateRequest): Promise<ResolveCandidateDuplicateResult> {
    return (await apiClient.post<ResolveCandidateDuplicateResult>(`/admin/candidate-duplicate-cases/${caseId}/resolve`, body)).data;
  },
};
