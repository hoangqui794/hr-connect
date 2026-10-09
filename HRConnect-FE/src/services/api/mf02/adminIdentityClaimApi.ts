import { apiClient } from '../../apiClient';
import type { ApiEnvelope, Paged } from '@/types/api/admin';
import type {
  AdminIdentityClaimDecisionResult,
  AdminIdentityClaimDetail,
  AdminIdentityClaimListItem,
  AdminIdentityClaimListParams,
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
};
