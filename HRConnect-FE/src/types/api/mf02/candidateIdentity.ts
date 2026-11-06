/** Candidate email identity and claim contracts. */
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

export interface CandidateDuplicateJobDto {
  jobId: string;
  title: string;
  companyId: string;
  companyName: string;
}

export interface CandidateDuplicateCaseItem {
  duplicateCaseId: string;
  status: 'OPEN' | 'AWAITING_CANDIDATE' | 'UNDER_REVIEW' | 'MERGED' | 'DISMISSED' | 'BLOCKED_FINANCE' | string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  title: string;
  guidance: string;
  actionRequired: boolean;
  job: CandidateDuplicateJobDto | null;
  evidenceTypes: string[];
  createdAt: string;
  updatedAt: string;
  concurrencyToken?: string;
}

export interface CandidateDuplicateCaseDetail extends CandidateDuplicateCaseItem {
  resolution: string | null;
}

export interface CandidateDuplicateCaseListResponse {
  items: CandidateDuplicateCaseItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface CandidateDuplicateCaseDecisionResponse {
  success: boolean;
  message: string;
  duplicateCaseId: string;
  status: string;
  resolution: string | null;
  title: string;
  guidance: string;
  actionRequired: boolean;
  concurrencyToken: string;
}

export interface MakeCandidatePrimaryEmailIdentityResponse {
  success: boolean;
  message: string;
  emailIdentityId: string;
  email: string;
  kind: 'PRIMARY' | string;
  status: 'VERIFIED' | string;
  concurrencyToken: string;
}
