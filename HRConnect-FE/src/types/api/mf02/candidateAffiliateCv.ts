/** Candidate controls for CVs uploaded by Affiliates. */
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

