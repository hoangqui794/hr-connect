import { apiClient } from '../../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { PagedItems } from '@/types/api/hr';
import type { AffiliateAttribution, AffiliatePerformance, AffiliateProfile, AffiliateReferralProgress, AffiliateSubmission, AffiliateSubmissionDetail, LibraryCandidate, LibraryCandidateDetail, ResendSubmissionConsentResult, SubmitCandidateResult, TotalCountPage } from '@/types/api/mf02';
import { cleanParams, createMultipartBody } from './shared';

export type SubmitCandidateInput =
  | { candidateId: string; cvId: string; fullName?: never; email?: never; phone?: never; file?: never; note?: string }
  | { candidateId?: never; cvId?: never; fullName: string; email: string; phone?: string; file: File; note?: string };

export const affiliateApi = {
  async profile(): Promise<AffiliateProfile> {
    return (await apiClient.get<ApiEnvelope<AffiliateProfile>>('/affiliates/profile/me')).data.data;
  },
  async performance(): Promise<AffiliatePerformance> {
    return (await apiClient.get<ApiEnvelope<AffiliatePerformance>>('/affiliates/profile/me/performance')).data.data;
  },
  async submit(jobId: string, input: SubmitCandidateInput) {
    const body = 'candidateId' in input
      ? createMultipartBody({ candidateId: input.candidateId, cvId: input.cvId, note: input.note })
      : createMultipartBody({ fullName: input.fullName, email: input.email, phone: input.phone, note: input.note, file: input.file });
    return (await apiClient.post<{ success: boolean; message: string; data: SubmitCandidateResult }>(`/jobs/${jobId}/candidate-submissions`, body)).data;
  },
  async submissions(params: { status?: string; jobId?: string; candidateId?: string; fromDate?: string; toDate?: string; page: number; pageSize: number }): Promise<TotalCountPage<AffiliateSubmission>> {
    return (await apiClient.get<TotalCountPage<AffiliateSubmission>>('/affiliates/submissions', { params: cleanParams(params) })).data;
  },
  async submissionDetail(submissionId: string): Promise<AffiliateSubmissionDetail> {
    return (await apiClient.get<AffiliateSubmissionDetail>(`/affiliates/submissions/${submissionId}`)).data;
  },
  async resendConsent(submissionId: string): Promise<ResendSubmissionConsentResult> {
    return (await apiClient.post<ResendSubmissionConsentResult>(`/affiliates/submissions/${submissionId}/consent/resend`)).data;
  },
  async referrals(params: { jobId?: string; page: number; pageSize: number }): Promise<TotalCountPage<AffiliateReferralProgress>> {
    return (await apiClient.get<TotalCountPage<AffiliateReferralProgress>>('/affiliates/referrals', { params: cleanParams(params) })).data;
  },
  async attributions(params: { jobId?: string; page: number; pageSize: number }): Promise<TotalCountPage<AffiliateAttribution>> {
    return (await apiClient.get<TotalCountPage<AffiliateAttribution>>('/affiliates/attributions', { params: cleanParams(params) })).data;
  },
  async library(params: { search?: string; page: number; pageSize: number }): Promise<PagedItems<LibraryCandidate>> {
    const response = await apiClient.get<{ data: { items: LibraryCandidate[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } } }>('/affiliates/candidates', { params: cleanParams(params) });
    const { items, pagination } = response.data.data;
    return { items, page: pagination.page, pageSize: pagination.pageSize, total: pagination.totalItems, totalPages: pagination.totalPages };
  },
  async libraryDetail(candidateId: string): Promise<LibraryCandidateDetail> {
    return (await apiClient.get<{ data: LibraryCandidateDetail }>(`/affiliates/candidates/${candidateId}`)).data.data;
  },
  async libraryCvUrl(candidateId: string, cvId: string): Promise<{ downloadUrl: string }> {
    return (await apiClient.get<ApiEnvelope<{ downloadUrl: string }>>(`/affiliates/candidates/${candidateId}/cvs/${cvId}/download-url`)).data.data;
  },
};
