import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type {
  CandidateDuplicateCaseDecisionResponse,
  CandidateDuplicateCaseDetail,
  CandidateDuplicateCaseListResponse,
  CandidateEmailIdentity,
  CandidateIdentityClaimState,
  CandidateIdentityClaimVerification,
  MakeCandidatePrimaryEmailIdentityResponse,
} from '@/types/api/mf02';

export const candidateIdentityApi = {
  async listEmailIdentities(): Promise<CandidateEmailIdentity[]> {
    return (await apiClient.get<ApiEnvelope<{ items: CandidateEmailIdentity[] }>>('/candidates/me/email-identities')).data.data.items;
  },
  async revoke(emailIdentityId: string, concurrencyToken: string) {
    return (await apiClient.post<{ success: boolean; emailIdentityId: string; status: string; revokedAt: string; concurrencyToken: string }>(
      `/candidates/me/email-identities/${emailIdentityId}/revoke`,
      { concurrencyToken }
    )).data;
  },
  async makePrimary(emailIdentityId: string, concurrencyToken?: string): Promise<MakeCandidatePrimaryEmailIdentityResponse> {
    return (await apiClient.post<MakeCandidatePrimaryEmailIdentityResponse>(
      `/candidates/me/email-identities/${encodeURIComponent(emailIdentityId)}/make-primary`,
      concurrencyToken ? { concurrencyToken } : {}
    )).data;
  },
  async start(email: string): Promise<{ success: boolean; message: string; data: CandidateIdentityClaimState }> {
    return (await apiClient.post<{ success: boolean; message: string; data: CandidateIdentityClaimState }>('/candidates/me/identity-claims', { email })).data;
  },
  async resend(claimId: string, concurrencyToken: string): Promise<CandidateIdentityClaimState & { success: boolean; message: string }> {
    return (await apiClient.post<CandidateIdentityClaimState & { success: boolean; message: string }>(`/candidates/me/identity-claims/${claimId}/resend`, { concurrencyToken })).data;
  },
  async verify(claimId: string, otp: string, concurrencyToken: string): Promise<CandidateIdentityClaimVerification> {
    return (await apiClient.post<CandidateIdentityClaimVerification>(`/candidates/me/identity-claims/${claimId}/verify`, { otp, concurrencyToken })).data;
  },
  async listDuplicateCases(params?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CandidateDuplicateCaseListResponse> {
    const res = await apiClient.get<ApiEnvelope<CandidateDuplicateCaseListResponse> | CandidateDuplicateCaseListResponse>(
      '/candidates/me/duplicate-cases',
      { params }
    );
    if (res.data && 'data' in res.data && res.data.data) {
      return res.data.data;
    }
    return res.data as CandidateDuplicateCaseListResponse;
  },
  async getDuplicateCaseDetail(caseId: string): Promise<CandidateDuplicateCaseDetail> {
    const res = await apiClient.get<ApiEnvelope<CandidateDuplicateCaseDetail> | CandidateDuplicateCaseDetail>(
      `/candidates/me/duplicate-cases/${encodeURIComponent(caseId)}`
    );
    if (res.data && 'data' in res.data && res.data.data) {
      return res.data.data;
    }
    return res.data as CandidateDuplicateCaseDetail;
  },
  async dismissDuplicateCase(caseId: string, reason?: string, concurrencyToken?: string): Promise<CandidateDuplicateCaseDecisionResponse> {
    return (await apiClient.post<CandidateDuplicateCaseDecisionResponse>(
      `/candidates/me/duplicate-cases/${encodeURIComponent(caseId)}/dismiss`,
      { reason, concurrencyToken }
    )).data;
  },
  async decideDuplicateCase(
    caseId: string,
    decision: 'DISMISS' | 'NOT_ME' | 'MERGE' | 'CONFIRM_SAME_PERSON',
    reason?: string,
    concurrencyToken?: string
  ): Promise<CandidateDuplicateCaseDecisionResponse> {
    return (await apiClient.post<CandidateDuplicateCaseDecisionResponse>(
      `/candidates/me/duplicate-cases/${encodeURIComponent(caseId)}/decision`,
      { decision, reason, concurrencyToken }
    )).data;
  },
};
