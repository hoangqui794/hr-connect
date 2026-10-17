/** Candidate-facing status groups returned by GET /candidates/applications. */
export type CandidateApplicationDisplayGroup =
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'SELECTED'
  | 'INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'NOT_SELECTED'
  | 'WITHDRAWN';

/** Candidate application list projection and self-apply contracts. */
export interface CandidateApplication {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  cvId: string | null;
  cvTitle: string | null;
  displayGroup: CandidateApplicationDisplayGroup;
  displayLabel: string;
  aiStatus: string | null;
  submissionSource: 'CANDIDATE' | 'AFFILIATE' | null;
  appliedAt: string;
}

/** Legacy MF-02 detail projection. The main detail page now consumes MF-04. */
export interface CandidateApplicationDetail {
  applicationId: string;
  candidateId: string;
  jobId: string;
  jobTitle: string;
  companyId: string | null;
  companyName: string;
  cvId: string | null;
  cvTitle: string | null;
  cvFileName: string | null;
  displayGroup: CandidateApplicationDisplayGroup;
  displayLabel: string;
  /** Compatibility fields used only when a newer MF-04 detail response is supplied. */
  status?: string;
  currentStage?: string | null;
  statusReason?: string | null;
  submissionSource: string | null;
  appliedAt: string;
  updatedAt: string;
  aiStatus: string | null;
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

