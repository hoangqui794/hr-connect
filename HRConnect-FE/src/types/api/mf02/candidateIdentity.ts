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
  duplicateCaseId?: string | null;
}

