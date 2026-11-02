/** Admin review contracts for Candidate identity claims. */
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
  skillCount: number;
  highestEducation: string | null;
  yearsOfExperience: number | null;
  currentJobTitle: string | null;
  summary: string | null;
  dateOfBirth: string | null;
  createdAt: string;
  updatedAt: string;
  primaryCvId: string | null;
  primaryCvTitle: string | null;
  primaryCvFileName: string | null;
  hasBusinessData: boolean;
}

export interface AdminIdentityClaimEvidence {
  emailOwnershipVerified: boolean;
  sameFullName: boolean;
  samePhone: boolean;
  sameDateOfBirth: boolean;
  exactCvMatch: boolean;
  similarCvText: boolean;
  supportingSignalCount: number;
  conflictingSignalCount: number;
}

export interface CandidateMergePreview {
  duplicateCaseId: string;
  recommendedCanonicalCandidateId: string;
  sourceCandidateId: string;
  recommendationReason: string;
  canMerge: boolean;
  collisions: Array<{
    jobId: string;
    jobTitle: string;
    candidateIds: string[];
    submissionIds: string[];
    applicationIds: string[];
    resolutionRule: string;
  }>;
  financeBlockers: Array<{
    applicationId: string;
    attributionId: string;
    commissionId: string;
    payoutId: string;
    payoutStatus: string;
    reasonCode: string;
  }>;
  concurrencyToken: string;
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
  duplicateCaseId: string | null;
  requesterCandidate: AdminIdentityClaimCandidateDetail;
  targetCandidate: AdminIdentityClaimCandidateDetail | null;
  currentEmailOwner: AdminIdentityClaimEmailOwner | null;
  evidence: AdminIdentityClaimEvidence;
}

export interface AdminIdentityClaimDecisionResult {
  success: boolean;
  message: string;
  claimId: string;
  status: AdminIdentityClaimStatus;
  canonicalCandidateId?: string;
  concurrencyToken: string;
}

export interface AdminIdentityClaimCvDownloadUrl {
  candidateId: string;
  cvId: string;
  fileName: string;
  mimeType: string;
  downloadUrl: string;
  expiresAt: string;
}

