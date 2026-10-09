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

export interface CandidateAffiliateCv {
  cvId: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  documentStatus: string;
  affiliateReuseStatus: string;
  reuseConcurrencyToken: string;
  affiliateUserId: string;
  affiliateDisplayName: string;
  submissionCount: number;
  pendingConsentCount: number;
  acceptedSubmissionCount: number;
  lastSubmittedAt: string | null;
  createdAt: string;
}

export interface CandidateAffiliateCvDetail extends CandidateAffiliateCv {
  reuseChangedAt: string | null;
  declinedSubmissionCount: number;
  expiredSubmissionCount: number;
  updatedAt: string;
}

export interface CandidateAffiliateCvUsage {
  submissionId: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  affiliateUserId: string;
  affiliateDisplayName: string;
  submissionStatus: string;
  submittedAt: string;
  consentStatus: string | null;
  consentRequestedAt: string | null;
  consentExpiresAt: string | null;
  consentRespondedAt: string | null;
  applicationId: string | null;
  applicationStatus: string | null;
  applicationCurrentStage: string | null;
  aiStatus: string | null;
  aiMatchScore: number | null;
  aiMatchTier: string | null;
  aiCompletedAt: string | null;
}

export interface CandidateAffiliateCvReuseResult {
  cvId: string;
  affiliateReuseStatus: string;
  reuseConcurrencyToken: string;
  reuseChangedAt: string | null;
}

export interface CandidateAffiliateCvAdoptionResult {
  sourceCvId: string;
  cvId: string;
  title: string;
  fileName: string | null;
  isPrimary: boolean;
  status: string;
  alreadyAdopted: boolean;
  createdAt: string;
}

export interface CandidateEmailIdentity {
  emailIdentityId: string;
  email: string;
  kind: 'PRIMARY' | 'ALIAS' | string;
  status: 'VERIFIED' | 'PENDING' | 'REVOKED' | string;
  verificationSource: string;
  verifiedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  concurrencyToken: string;
  canRevoke: boolean;
  canMakePrimary: boolean;
}

export interface CandidateIdentityClaimState {
  claimId: string;
  maskedDestination: string;
  expiresAt: string;
  resendAfter: string;
  concurrencyToken: string;
  resendCount?: number;
  emailDeliveryStatus?: string;
}

export interface CandidateIdentityClaimVerification {
  success: boolean;
  message: string;
  claimId: string;
  status: 'COMPLETED' | 'PENDING_ADMIN_REVIEW' | string;
  candidateId: string | null;
  concurrencyToken: string;
}

export type AdminIdentityClaimStatus =
  | 'PENDING_ADMIN_REVIEW'
  | 'COMPLETED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED'
  | string;

export interface AdminIdentityClaimListItem {
  claimId: string;
  requesterUserId: string;
  requesterCandidateId: string;
  targetCandidateId: string | null;
  maskedAssertedEmail: string;
  status: AdminIdentityClaimStatus;
  reviewReason: string | null;
  requesterDisplayName: string;
  requesterPrimaryEmail: string;
  requesterCandidateName: string;
  targetCandidateName: string | null;
  createdAt: string;
  verifiedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
}

export interface AdminIdentityClaimListParams {
  status?: AdminIdentityClaimStatus;
  search?: string;
  page: number;
  pageSize: number;
  sortBy?: 'createdAt' | 'verifiedAt' | 'reviewedAt';
  sortDirection?: 'asc' | 'desc';
}

export interface AdminIdentityClaimCandidateDetail {
  candidateId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  mergedIntoCandidateId: string | null;
  cvCount: number;
  submissionCount: number;
  applicationCount: number;
  matchCount: number;
  hasBusinessData: boolean;
}

export interface AdminIdentityClaimEmailOwner {
  emailIdentityId: string;
  userId: string;
  primaryEmail: string;
  displayName: string;
  kind: string;
  status: string;
}

export interface AdminIdentityClaimDetail {
  claimId: string;
  requesterUserId: string;
  requesterDisplayName: string;
  requesterPrimaryEmail: string;
  requesterUserStatus: string;
  assertedEmail: string;
  status: AdminIdentityClaimStatus;
  reviewReason: string | null;
  expiresAt: string;
  attemptCount: number;
  resendCount: number;
  lastSentAt: string | null;
  verifiedAt: string | null;
  completedAt: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
  requesterCandidate: AdminIdentityClaimCandidateDetail;
  targetCandidate: AdminIdentityClaimCandidateDetail | null;
  currentEmailOwner: AdminIdentityClaimEmailOwner | null;
}

export interface AdminIdentityClaimDecisionResult {
  success: boolean;
  message: string;
  claimId: string;
  status: AdminIdentityClaimStatus;
  canonicalCandidateId?: string;
  concurrencyToken: string;
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

export interface AffiliateSubmissionDetail extends AffiliateSubmission {
  consentRequestedAt: string | null;
  consentEmailSentAt: string | null;
  candidateEmail: string | null;
  candidatePhone: string | null;
  companyName: string;
  cvTitle: string | null;
  cvFileName: string | null;
  updatedAt: string;
}

export interface ResendSubmissionConsentResult {
  success: boolean;
  message: string;
  submissionId: string;
  status: string;
  expiresAt: string;
  emailSendCount: number;
  emailDeliveryStatus: string;
}

export interface SubmissionConsentReview {
  submissionId: string;
  status: string;
  expiresAt: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  cvFileName: string;
  cvDownloadUrl: string | null;
  cvUrlExpiresAt: string | null;
  affiliateReuseStatus: string | null;
  reuseConcurrencyToken: string | null;
}

export interface SubmissionConsentDecisionResult {
  success: boolean;
  message: string;
  submissionId: string;
  submissionStatus: string;
  applicationId: string | null;
  aiStatus: string;
  affiliateReuseStatus: string | null;
  reuseConcurrencyToken: string | null;
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
  attributionId: string | null;
  affiliateId: string;
  submissionId: string;
  candidateId: string;
  jobId: string;
  cvId: string;
  status: SubmissionStatus;
  aiStatus: string;
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
