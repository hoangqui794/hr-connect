import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { CandidateEmailIdentity, CandidateIdentityClaimState, CandidateIdentityClaimVerification } from '@/types/api/mf02';

export const candidateIdentityApi = {
  async listEmailIdentities(): Promise<CandidateEmailIdentity[]> {
    return (await apiClient.get<ApiEnvelope<{ items: CandidateEmailIdentity[] }>>('/candidates/me/email-identities')).data.data.items;
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
};
