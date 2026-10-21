export type CandidateDuplicateStatus =
  | 'OPEN'
  | 'AWAITING_CANDIDATE'
  | 'UNDER_REVIEW'
  | 'MERGED'
  | 'DISMISSED'
  | 'BLOCKED_FINANCE'
  | string;

export interface CandidateDuplicateJob {
  jobId: string;
  title: string;
  companyId: string;
  companyName: string;
}

export interface MyCandidateDuplicateCaseListItem {
  duplicateCaseId: string;
  status: CandidateDuplicateStatus;
  riskLevel: string;
  title: string;
  guidance: string;
  actionRequired: boolean;
  job: CandidateDuplicateJob | null;
  evidenceTypes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MyCandidateDuplicateCaseDetail extends MyCandidateDuplicateCaseListItem {
  resolution: string | null;
}

export interface CandidateDuplicatePage<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface AdminCandidateDuplicateParty {
  candidateId: string;
  fullName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  hasAccount: boolean;
  status: string;
  createdAt: string;
}

export interface AdminCandidateDuplicateCaseListItem {
  duplicateCaseId: string;
  status: CandidateDuplicateStatus;
  riskLevel: string;
  candidateA: AdminCandidateDuplicateParty;
  candidateB: AdminCandidateDuplicateParty;
  jobId: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
}

export interface CandidateDuplicateSignal {
  reasonCode: string;
  detectorVersion: string;
  score: number;
  evidence: string;
  createdAt: string;
}

export interface CandidateDuplicateSubmission {
  submissionId: string;
  candidateId: string;
  status: string;
  source: string;
  submittedAt: string;
  consentStatus: string | null;
  consentRespondedAt: string | null;
  applicationId: string | null;
  attributionId: string | null;
  affiliateId: string | null;
  attributionStatus: string | null;
  commissionStatuses: string[];
}

export interface AdminCandidateDuplicateCaseDetail {
  duplicateCaseId: string;
  status: CandidateDuplicateStatus;
  riskLevel: string;
  resolution: string | null;
  resolutionReason: string | null;
  candidateA: AdminCandidateDuplicateParty;
  candidateB: AdminCandidateDuplicateParty;
  canonicalCandidateId: string | null;
  job: CandidateDuplicateJob | null;
  signals: CandidateDuplicateSignal[];
  submissions: CandidateDuplicateSubmission[];
  createdAt: string;
  updatedAt: string;
  concurrencyToken: string;
}

export interface CandidateMergeCollision {
  jobId: string;
  jobTitle: string;
  candidateIds: string[];
  submissionIds: string[];
  applicationIds: string[];
  resolutionRule: string;
}

export interface CandidateMergeFinanceBlocker {
  applicationId: string;
  attributionId: string;
  commissionId: string;
  payoutId: string;
  payoutStatus: string;
  reasonCode: string;
}

export interface CandidateDuplicateMergePreview {
  duplicateCaseId: string;
  recommendedCanonicalCandidateId: string;
  sourceCandidateId: string;
  recommendationReason: string;
  canMerge: boolean;
  collisions: CandidateMergeCollision[];
  financeBlockers: CandidateMergeFinanceBlocker[];
  concurrencyToken: string;
}

export type CandidateDuplicateDecision = 'MERGE' | 'DISMISS' | 'NEED_MORE_EVIDENCE';

export interface ResolveCandidateDuplicateRequest {
  decision: CandidateDuplicateDecision;
  reason: string;
  concurrencyToken: string;
  idempotencyKey: string;
}

export interface IdentityReviewFinalizationResult {
  submissionId: string;
  status: string;
  applicationId: string | null;
  reasonCode: string | null;
  aiStatus: string;
}

export interface ResolveCandidateDuplicateResult {
  duplicateCaseId: string;
  status: CandidateDuplicateStatus;
  resolution: string | null;
  canonicalCandidateId: string | null;
  sourceCandidateId: string | null;
  pendingFinalizationSubmissionIds: string[];
  finalizationResults: IdentityReviewFinalizationResult[];
  concurrencyToken: string;
  idempotentReplay: boolean;
}
