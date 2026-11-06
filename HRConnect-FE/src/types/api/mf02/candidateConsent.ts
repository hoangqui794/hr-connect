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
  cvFileSizeBytes?: number | null;
  affiliateUserId: string;
  affiliateDisplayName: string;
  affiliateEmail?: string | null;
  affiliatePhone?: string | null;
  pitchText?: string | null;
  candidateConditionSummary?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode?: string;
  salaryCurrency?: string;
  salaryNegotiable?: boolean;
  isSalaryNegotiable?: boolean;
  jobLocation?: string | null;
  workLocation?: string | null;
  workMode?: string | null;
  employmentType?: string | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  experienceRequirement?: string | null;
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
  jobId?: string;
  companyId?: string;
  companyLogoUrl?: string | null;
  status: string;
  expiresAt: string;
  candidateName: string;
  jobTitle: string;
  companyName: string;
  jobLocation?: string | null;
  workLocation?: string | null;
  workMode?: string | null;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currencyCode?: string;
  salaryCurrency?: string;
  salaryNegotiable?: boolean;
  isSalaryNegotiable?: boolean;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  experienceRequirement?: string | null;
  affiliateDisplayName?: string | null;
  affiliateEmail?: string | null;
  affiliatePhone?: string | null;
  pitchText?: string | null;
  candidateConditionSummary?: string | null;
  cvFileName: string;
  cvFileSizeBytes?: number | null;
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

export interface ReportUnauthorizedConsentResult {
  success: boolean;
  message: string;
  submissionId: string;
  status: string;
}
