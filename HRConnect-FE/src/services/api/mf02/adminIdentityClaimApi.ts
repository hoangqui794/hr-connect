import { apiClient } from '../../apiClient';
import type { ApiEnvelope, Paged } from '@/types/api/admin';
import type {
  AdminCandidateDuplicateDetail,
  AdminCandidateDuplicateListParams,
  AdminCandidateDuplicateListResponse,
  AdminCandidateDuplicateResolvePayload,
  AdminCandidateDuplicateResolveResult,
  AdminIdentityClaimDecisionResult,
  AdminIdentityClaimCvDownloadUrl,
  AdminIdentityClaimDetail,
  AdminIdentityClaimListItem,
  AdminIdentityClaimListParams,
  CandidateMergePreview,
} from '@/types/api/mf02';
import { cleanParams } from './shared';

export const adminIdentityClaimApi = {
  /** GET /admin/candidate-identity-claims — requires candidate.identity.review. */
  async list(params: AdminIdentityClaimListParams): Promise<Paged<AdminIdentityClaimListItem>> {
    const response = await apiClient.get<ApiEnvelope<Paged<AdminIdentityClaimListItem>>>(
      '/admin/candidate-identity-claims',
      { params: cleanParams(params) }
    );
    return response.data.data;
  },
  async get(claimId: string): Promise<AdminIdentityClaimDetail> {
    const response = await apiClient.get<ApiEnvelope<AdminIdentityClaimDetail>>(
      `/admin/candidate-identity-claims/${claimId}`
    );
    return response.data.data;
  },
  async getCvDownloadUrl(claimId: string, candidateId: string): Promise<AdminIdentityClaimCvDownloadUrl> {
    const response = await apiClient.get<ApiEnvelope<AdminIdentityClaimCvDownloadUrl>>(
      `/admin/candidate-identity-claims/${claimId}/candidates/${candidateId}/cv-download-url`
    );
    return response.data.data;
  },
  async approve(claimId: string, concurrencyToken: string, note?: string): Promise<AdminIdentityClaimDecisionResult> {
    return (
      await apiClient.post<AdminIdentityClaimDecisionResult>(
        `/admin/candidate-identity-claims/${claimId}/approve`,
        { concurrencyToken, note: note || null }
      )
    ).data;
  },
  async reject(claimId: string, concurrencyToken: string, reason: string): Promise<AdminIdentityClaimDecisionResult> {
    return (
      await apiClient.post<AdminIdentityClaimDecisionResult>(
        `/admin/candidate-identity-claims/${claimId}/reject`,
        { concurrencyToken, reason }
      )
    ).data;
  },
  /** GET /admin/candidate-duplicate-cases — requires candidate_duplicate.view. */
  async listDuplicateCases(
    params: AdminCandidateDuplicateListParams
  ): Promise<AdminCandidateDuplicateListResponse> {
    return (
      await apiClient.get<AdminCandidateDuplicateListResponse>('/admin/candidate-duplicate-cases', {
        params: cleanParams(params),
      })
    ).data;
  },
  /** GET /admin/candidate-duplicate-cases/:caseId — requires candidate_duplicate.view. */
  async getDuplicateCase(caseId: string): Promise<AdminCandidateDuplicateDetail> {
    return (
      await apiClient.get<AdminCandidateDuplicateDetail>(
        `/admin/candidate-duplicate-cases/${caseId}`
      )
    ).data;
  },
  async previewMerge(caseId: string): Promise<CandidateMergePreview> {
    return (
      await apiClient.post<CandidateMergePreview>(
        `/admin/candidate-duplicate-cases/${caseId}/preview-merge`
      )
    ).data;
  },
  /** POST /admin/candidate-duplicate-cases/:caseId/resolve — requires candidate_duplicate.resolve. */
  async resolveDuplicateCase(
    caseId: string,
    payload: AdminCandidateDuplicateResolvePayload
  ): Promise<AdminCandidateDuplicateResolveResult> {
    return (
      await apiClient.post<AdminCandidateDuplicateResolveResult>(
        `/admin/candidate-duplicate-cases/${caseId}/resolve`,
        payload
      )
    ).data;
  },
  async mergeDuplicateCase(caseId: string, preview: CandidateMergePreview, reason: string) {
    return (
      await apiClient.post(`/admin/candidate-duplicate-cases/${caseId}/resolve`, {
        decision: 'MERGE',
        reason,
        concurrencyToken: preview.concurrencyToken,
        idempotencyKey: `identity-claim-merge:${caseId}`,
      })
    ).data;
  },
};
