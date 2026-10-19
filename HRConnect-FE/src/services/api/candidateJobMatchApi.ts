/**
 * @file services/api/candidateJobMatchApi.ts
 * @description API client for candidate job matches (SF-07).
 * Endpoint: GET /api/v1/candidates/me/job-matches
 */

import { apiClient } from '../apiClient';
import type { CandidateJobMatchDto } from '@/types/api/candidateJobMatch';

export const candidateJobMatchApi = {
  /**
   * GET /candidates/me/job-matches
   * Fetches up to 20 AI-computed job matches for the authenticated Candidate.
   */
  async getJobMatches(): Promise<CandidateJobMatchDto[]> {
    const res = await apiClient.get<CandidateJobMatchDto[] | { success?: boolean; data: CandidateJobMatchDto[] }>(
      '/candidates/me/job-matches'
    );
    const body = res.data as any;
    if (body && typeof body === 'object' && 'data' in body && Array.isArray(body.data)) {
      return body.data as CandidateJobMatchDto[];
    }
    if (Array.isArray(body)) {
      return body as CandidateJobMatchDto[];
    }
    return [];
  },
};
