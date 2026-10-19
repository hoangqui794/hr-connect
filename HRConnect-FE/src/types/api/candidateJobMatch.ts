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
  location: string;
  matchScore: number;
  generatedAt: string;
  expiresAt: string;
}
