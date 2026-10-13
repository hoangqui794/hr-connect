/** Candidate consent inbox, review and decision contracts. */
export interface CandidateSubmissionConsent {
  submissionId: string;
  consentStatus: 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED' | string;
  submissionStatus: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  cvId: string;
  cvTitle: string;
  cvFileName: string | null;
  affiliateUserId: string;
  affiliateDisplayName: string;
  requestedAt: string;
  expiresAt: string;
  respondedAt: string | null;
  isActionable: boolean;
  remainingSeconds: number;
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

