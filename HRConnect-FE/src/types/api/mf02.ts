/**
 * @file types/api/mf02.ts
 * @description MF-02 types (candidate intake, duplicate check, attribution), mirrored from the backend:
 * ApplyJobResponse, SubmitCandidateResponse, CandidateCv list, CandidateApplicationItemDto,
 * AffiliateSubmissionItemDto, AffiliateReferralProgressItemDto, AffiliateAttributionItemDto,
 * AffiliateCandidateLibrary*, AffiliateProfile / Performance.
 */

export interface CandidateCv {
  cvId: string;
  title: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  isPrimary: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateApplication {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  cvId: string | null;
  cvTitle: string | null;
  status: string;
  aiStatus: string | null;
  appliedAt: string;
}

export interface CandidateApplicationDetail extends CandidateApplication {
  candidateId: string;
  companyId: string | null;
  cvFileName: string | null;
  currentStage: string | null;
  statusReason: string | null;
  submissionSource: string | null;
  updatedAt: string;
  aiMatchScore: number | null;
  aiMatchTier: string | null;
}

export interface ApplyJobResult {
  applicationId: string;
  submissionId: string;
  candidateId: string;
  jobId: string;
  cvId: string;
  status: string;
  aiStatus: string;
  appliedAt: string;
}

/** Affiliate lists are returned without the success/data envelope. */
export interface TotalCountPage<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type SubmissionStatus = 'PENDING_CONSENT' | 'ACCEPTED' | 'CONSENT_REJECTED' | 'CONSENT_EXPIRED' | 'BLOCKED_DUPLICATE' | string;

export interface AffiliateSubmission {
  submissionId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  cvId: string;
  status: SubmissionStatus;
  consentStatus: string | null;
  consentExpiresAt: string | null;
  consentRespondedAt: string | null;
  applicationId: string | null;
  attributionId: string | null;
  duplicateOfSubmissionId: string | null;
  reason: string | null;
  submittedAt: string;
}

export interface AffiliateReferralProgress {
  submissionId: string;
  applicationId: string | null;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  progressStatus: string;
  updatedAt: string;
}

export interface AffiliateAttribution {
  attributionId: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  cvId: string;
  attributionRule: string;
  status: string;
  establishedAt: string;
  updatedAt: string;
}

export interface LibraryCandidate {
  candidateId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  hasAccount: boolean;
  activeCvCount: number;
  acceptedSubmissionCount: number;
  lastSubmittedAt: string | null;
}

export interface LibraryCandidateDetail {
  candidateId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  hasAccount: boolean;
  acceptedSubmissionCount: number;
  cvs: {
    cvId: string;
    title: string;
    fileName: string | null;
    status: string;
    createdAt: string;
    acceptedSubmissionCount: number;
    lastUsedAt: string | null;
  }[];
}

export interface SubmitCandidateResult {
  applicationId: string | null;
  submissionId: string;
  candidateId: string;
  jobId: string;
  cvId: string;
  status: SubmissionStatus;
  consentExpiresAt: string | null;
  emailDeliveryStatus: string;
  submittedAt: string;
}

export interface AffiliateProfile {
  affiliateId: string;
  email: string;
  displayName: string;
  affiliateType: string;
  phone: string | null;
  status: string;
  verifiedAt: string | null;
}

export interface AffiliatePerformance {
  totalSubmissions: number;
  totalShortlisted: number;
  totalInterviews: number;
  totalPlacements: number;
  submissionToHireRate: number;
  ratingLabel: string;
}
