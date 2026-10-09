import { apiClient } from '../../apiClient';
import type { SubmissionConsentDecisionResult, SubmissionConsentReview } from '@/types/api/mf02';

export const candidateConsentApi = {
  async review(submissionId: string): Promise<SubmissionConsentReview> {
    return (await apiClient.get<{ success: boolean; data: SubmissionConsentReview }>(`/candidates/me/submission-consents/${submissionId}`)).data.data;
  },
  async respond(submissionId: string, decision: 'CONFIRM' | 'DECLINE', allowFutureReuse: boolean) {
    return (await apiClient.post<SubmissionConsentDecisionResult>(`/candidates/me/submission-consents/${submissionId}/respond`, { decision, allowFutureReuse })).data;
  },
  async reviewPublic(token: string): Promise<SubmissionConsentReview> {
    return (await apiClient.post<{ success: boolean; data: SubmissionConsentReview }>('/submission-consents/review', { token })).data.data;
  },
  async respondPublic(token: string, decision: 'CONFIRM' | 'DECLINE', allowFutureReuse: boolean) {
    return (await apiClient.post<SubmissionConsentDecisionResult>('/submission-consents/respond', { token, decision, allowFutureReuse })).data;
  },
};
