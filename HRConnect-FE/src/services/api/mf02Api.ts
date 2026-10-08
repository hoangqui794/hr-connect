/**
 * @file services/api/mf02Api.ts
 * @description MF-02 endpoints: candidate CV vault and self-apply (branch A), affiliate referral,
 * submission history, consent resend, candidate library and attribution (branch B).
 * Uploads are multipart/form-data with exactly one CV source (cvId or a PDF file).
 */
import { apiClient } from '../apiClient';
import type { ApiEnvelope } from '@/types/api/admin';
import type { PagedItems } from '@/types/api/hr';
import type {
  AffiliateAttribution,
  AffiliatePerformance,
  AffiliateProfile,
  AffiliateReferralProgress,
  AffiliateSubmission,
  ApplyJobResult,
  CandidateApplication,
  CandidateCv,
  LibraryCandidate,
  LibraryCandidateDetail,
  SubmitCandidateResult,
  TotalCountPage,
} from '@/types/api/mf02';

const clean = <T extends object>(params: T): Partial<T> =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;

/** apiClient defaults to JSON; axios 1.x would turn FormData into JSON under that header. */
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

const form = (fields: Record<string, string | Blob | undefined | null>) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v);
  });
  return fd;
};

// ─── Branch A: candidate ─────────────────────────────────────────────────────

export const candidateCvApi = {
  async list(): Promise<CandidateCv[]> {
    return (await apiClient.get<ApiEnvelope<CandidateCv[]>>('/candidates/cv')).data.data;
  },
  async upload(file: File, title?: string, isPrimary?: boolean) {
    const body = form({ file, title, isPrimary: isPrimary ? 'true' : undefined });
    return (await apiClient.post<ApiEnvelope<unknown> & { message?: string }>('/candidates/cv', body, MULTIPART)).data;
  },
  async setPrimary(cvId: string) {
    return (await apiClient.patch<{ message?: string }>(`/candidates/cv/${cvId}/primary`)).data;
  },
  async remove(cvId: string) {
    return (await apiClient.delete<{ message?: string }>(`/candidates/cv/${cvId}`)).data;
  },
  async updateTitle(cvId: string, title: string) {
    return (await apiClient.patch<{ message?: string }>(`/candidates/cv/${cvId}`, { title })).data;
  },
  async downloadUrl(cvId: string): Promise<{ downloadUrl: string }> {
    return (await apiClient.get<ApiEnvelope<{ downloadUrl: string }>>(`/candidates/cv/${cvId}/download-url`)).data.data;
  },
};

export const candidateApplicationsApi = {
  async list(params: { status?: string; page: number; pageSize: number }): Promise<PagedItems<CandidateApplication>> {
    return (await apiClient.get<ApiEnvelope<PagedItems<CandidateApplication>>>('/candidates/applications', { params: clean(params) })).data.data;
  },
  async get(applicationId: string): Promise<CandidateApplication> {
    return (await apiClient.get<ApiEnvelope<CandidateApplication>>(`/candidates/applications/${applicationId}`)).data.data;
  },
};

export const applyApi = {
  /** POST /jobs/{id}/apply — exactly one CV source: an existing cvId or a new PDF. */
  async apply(jobId: string, source: { cvId: string } | { file: File }) {
    const body = 'cvId' in source ? form({ cvId: source.cvId }) : form({ file: source.file });
    return (await apiClient.post<{ success: boolean; message: string; data: ApplyJobResult }>(`/jobs/${jobId}/apply`, body, MULTIPART)).data;
  },
};

// ─── Branch B: affiliate ─────────────────────────────────────────────────────

export interface SubmitCandidateInput {
  /** Candidate from the affiliate's library … */
  candidateId?: string;
  cvId?: string;
  /** … or a new candidate with a PDF. */
  fullName?: string;
  email?: string;
  phone?: string;
  file?: File;
  note?: string;
}

export interface UpdateAffiliateProfileInput {
  displayName: string;
  contactPerson?: string | null;
  phone?: string | null;
  address?: string | null;
  taxInformation?: string | null;
}

export interface AffiliateBankAccountData {
  affiliateId: string;
  displayName?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  bankBranch?: string | null;
  isConfigured: boolean;
  updatedAt: string;
}

export interface UpdateAffiliateBankAccountInput {
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  bankBranch?: string | null;
}
export const affiliateApi = {
  async profile(): Promise<AffiliateProfile> {
    return (await apiClient.get<ApiEnvelope<AffiliateProfile>>('/affiliates/profile/me')).data.data;
  },
  async updateProfile(input: UpdateAffiliateProfileInput) {
    return (await apiClient.put<{ success: boolean; message: string; data?: unknown }>('/affiliates/profile/me', input)).data;
  },
  async performance(): Promise<AffiliatePerformance> {
    return (await apiClient.get<ApiEnvelope<AffiliatePerformance>>('/affiliates/profile/me/performance')).data.data;
  },
  async getBankAccount(): Promise<AffiliateBankAccountData> {
    return (await apiClient.get<{ success: boolean; message: string; data: AffiliateBankAccountData }>('/affiliates/profile/me/bank-account')).data.data;
  },
  async updateBankAccount(input: UpdateAffiliateBankAccountInput) {
    return (await apiClient.put<{ success: boolean; message: string; data: AffiliateBankAccountData }>('/affiliates/profile/me/bank-account', input)).data;
  },
  async submit(jobId: string, input: SubmitCandidateInput) {
    const body = form({
      candidateId: input.candidateId,
      cvId: input.cvId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      note: input.note,
      file: input.file,
    });
    return (await apiClient.post<{ success: boolean; message: string; data: SubmitCandidateResult }>(`/jobs/${jobId}/candidate-submissions`, body, MULTIPART)).data;
  },
  async submissions(params: { status?: string; jobId?: string; page: number; pageSize: number }): Promise<TotalCountPage<AffiliateSubmission>> {
    return (await apiClient.get<TotalCountPage<AffiliateSubmission>>('/affiliates/submissions', { params: clean(params) })).data;
  },
  async submissionDetail(submissionId: string): Promise<AffiliateSubmission> {
    return (await apiClient.get<{ success: boolean; message: string; data: AffiliateSubmission }>(`/affiliates/submissions/${submissionId}`)).data.data;
  },
  async resendConsent(submissionId: string) {
    return (
      await apiClient.post<{ message: string; expiresAt: string; emailSendCount: number }>(`/affiliates/submissions/${submissionId}/consent/resend`)
    ).data;
  },
  async referrals(params: { jobId?: string; page: number; pageSize: number }): Promise<TotalCountPage<AffiliateReferralProgress>> {
    return (await apiClient.get<TotalCountPage<AffiliateReferralProgress>>('/affiliates/referrals', { params: clean(params) })).data;
  },
  async attributions(params: { jobId?: string; page: number; pageSize: number }): Promise<TotalCountPage<AffiliateAttribution>> {
    return (await apiClient.get<TotalCountPage<AffiliateAttribution>>('/affiliates/attributions', { params: clean(params) })).data;
  },
  async library(params: { search?: string; page: number; pageSize: number }): Promise<PagedItems<LibraryCandidate>> {
    const res = await apiClient.get<{ data: { items: LibraryCandidate[]; pagination: { page: number; pageSize: number; totalItems: number; totalPages: number } } }>(
      '/affiliates/candidates',
      { params: clean(params) }
    );
    const { items, pagination } = res.data.data;
    return { items, page: pagination.page, pageSize: pagination.pageSize, total: pagination.totalItems, totalPages: pagination.totalPages };
  },
  async libraryDetail(candidateId: string): Promise<LibraryCandidateDetail> {
    return (await apiClient.get<{ data: LibraryCandidateDetail }>(`/affiliates/candidates/${candidateId}`)).data.data;
  },
  async libraryCvUrl(candidateId: string, cvId: string): Promise<{ downloadUrl: string }> {
    return (await apiClient.get<ApiEnvelope<{ downloadUrl: string }>>(`/affiliates/candidates/${candidateId}/cvs/${cvId}/download-url`)).data.data;
  },
};

// ─── Branch C: candidate affiliate CV management ─────────────────────────────

export interface CandidateAffiliateCvItem {
  cvId: string;
  title: string;
  fileName: string;
  mimeType?: string;
  fileSizeBytes: number;
  documentStatus?: string;
  affiliateReuseStatus: 'ALLOWED' | 'REVOKED' | string;
  reuseConcurrencyToken: string;
  affiliateUserId?: string;
  affiliateDisplayName?: string;
  submissionCount: number;
  pendingConsentCount: number;
  acceptedSubmissionCount: number;
  lastSubmittedAt?: string;
  createdAt: string;
  alreadyAdopted?: boolean;
}

export interface CandidateAffiliateCvUsageItem {
  submissionId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  affiliateUserId: string;
  affiliateDisplayName: string;
  submissionStatus: string;
  submittedAt: string;
  consentStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED' | string;
  consentRequestedAt?: string;
  consentExpiresAt?: string;
  consentRespondedAt?: string;
  applicationId?: string;
  applicationStatus?: string;
  applicationCurrentStage?: string;
  aiStatus?: string;
  aiMatchScore?: number | null;
  aiMatchTier?: string | null;
  aiCompletedAt?: string;
}

export const candidateAffiliateCvsApi = {
  async list(params?: { page?: number; pageSize?: number }): Promise<{
    success: boolean;
    data: {
      items: CandidateAffiliateCvItem[];
      pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
    };
  }> {
    return (await apiClient.get('/candidates/me/affiliate-cvs', { params: clean(params || {}) })).data;
  },
  async get(cvId: string): Promise<any> {
    return (await apiClient.get(`/candidates/me/affiliate-cvs/${cvId}`)).data;
  },
  async usages(cvId: string, params?: { page?: number; pageSize?: number }): Promise<{
    success: boolean;
    data: {
      cvId: string;
      items: CandidateAffiliateCvUsageItem[];
      pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
    };
  }> {
    return (await apiClient.get(`/candidates/me/affiliate-cvs/${cvId}/usages`, { params: clean(params || {}) })).data;
  },
  async downloadUrl(cvId: string): Promise<{ downloadUrl: string }> {
    return (await apiClient.get<ApiEnvelope<{ downloadUrl: string }>>(`/candidates/me/affiliate-cvs/${cvId}/download-url`)).data.data;
  },
  async updateReuse(cvId: string, allowed: boolean, concurrencyToken?: string): Promise<{
    success: boolean;
    message?: string;
    data?: any;
  }> {
    return (await apiClient.patch(`/candidates/me/affiliate-cvs/${cvId}/reuse`, { allowed, concurrencyToken })).data;
  },
  async adopt(cvId: string, title?: string): Promise<{
    success: boolean;
    message?: string;
    data?: { cvId: string; alreadyAdopted: boolean; title: string };
  }> {
    return (await apiClient.post(`/candidates/me/affiliate-cvs/${cvId}/adopt`, { title })).data;
  },
};

// ─── Branch D: submission consents (confirmation flow) ──────────────────────

export interface SubmissionConsentReviewData {
  submissionId: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  cvFileName: string;
  cvDownloadUrl?: string;
  cvUrlExpiresAt?: string;
  expiresAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED' | string;
  affiliateName?: string;
  affiliateReuseStatus?: string;
  reuseConcurrencyToken?: string;
}

export const submissionConsentsApi = {
  /** Unregistered candidate reviews consent via email token */
  async reviewPublic(token: string): Promise<{ success?: boolean; data: SubmissionConsentReviewData }> {
    return (await apiClient.post('/submission-consents/review', { token })).data;
  },
  /** Unregistered candidate responds to consent via email token */
  async respondPublic(data: { token: string; decision: 'CONFIRM' | 'DECLINE'; allowFutureReuse?: boolean }): Promise<{
    success?: boolean;
    message?: string;
    data?: any;
  }> {
    return (await apiClient.post('/submission-consents/respond', data)).data;
  },
  /** Logged-in candidate reviews consent by submissionId */
  async reviewAuth(submissionId: string): Promise<{ success?: boolean; data: SubmissionConsentReviewData }> {
    return (await apiClient.get(`/candidates/me/submission-consents/${submissionId}`)).data;
  },
  /** Logged-in candidate responds to consent by submissionId */
  async respondAuth(submissionId: string, data: { decision: 'CONFIRM' | 'DECLINE'; allowFutureReuse?: boolean }): Promise<{
    success?: boolean;
    message?: string;
    data?: any;
  }> {
    return (await apiClient.post(`/candidates/me/submission-consents/${submissionId}/respond`, data)).data;
  },
};



