/** Candidate application and self-apply contracts. */
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

