/**
 * @file types/api/candidateJobMatch.ts
 * @description Type definitions for Candidate Job Matches (SF-07).
 * Endpoint: GET /api/v1/candidates/me/job-matches
 */

export interface CandidateJobMatchDto {
  candidateJobMatchId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  companyLogoUrl?: string | null;
  location: string;
  employmentType?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryNegotiable?: boolean;
  currencyCode?: string;
  matchScore: number;
  matchTier?: string | null;
  matchTierLabel?: string | null;
  matchingReasons?: string[];
  missingRequirements?: string[];
  generatedAt: string;
  applicationDeadline?: string | null;
  expiresAt: string;
}

export interface CandidateJobMatchFeedMeta {
  hasPrimaryCv: boolean;
  lastGeneratedAt?: string | null;
  scoringVersion: string;
}

export interface CandidateJobMatchFeed {
  items: CandidateJobMatchDto[];
  meta: CandidateJobMatchFeedMeta;
}
