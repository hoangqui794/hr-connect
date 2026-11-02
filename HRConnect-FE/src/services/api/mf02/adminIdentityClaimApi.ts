import { apiClient } from '../../apiClient';
import type { ApiEnvelope, Paged } from '@/types/api/admin';
import type {
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
  async previewMerge(caseId: string): Promise<CandidateMergePreview> {
    return (
      await apiClient.post<CandidateMergePreview>(
        `/admin/candidate-duplicate-cases/${caseId}/preview-merge`
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
