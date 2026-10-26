/**
 * @file services/api/candidateJobMatchApi.ts
 * @description API client for candidate job matches (SF-07).
 * Endpoint: GET /api/v1/candidates/me/job-matches
 */

import { apiClient } from '../apiClient';
import type { CandidateJobMatchDto, CandidateJobMatchFeed, CandidateJobMatchFeedMeta } from '@/types/api/candidateJobMatch';

const defaultMeta: CandidateJobMatchFeedMeta = {
  hasPrimaryCv: true,
  lastGeneratedAt: null,
  scoringVersion: 'HYBRID_V1',
};

export const candidateJobMatchApi = {
  /**
   * GET /candidates/me/job-matches
   * Fetches up to 20 AI-computed job matches for the authenticated Candidate.
   */
  async getJobMatches(): Promise<CandidateJobMatchFeed> {
    const res = await apiClient.get<CandidateJobMatchDto[] | {
      success?: boolean;
      data: CandidateJobMatchDto[];
      meta?: CandidateJobMatchFeedMeta;
    }>(
      '/candidates/me/job-matches'
    );
    const body = res.data as any;
    if (body && typeof body === 'object' && 'data' in body && Array.isArray(body.data)) {
      return { items: body.data as CandidateJobMatchDto[], meta: body.meta ?? defaultMeta };
    }
    if (Array.isArray(body)) {
      return { items: body as CandidateJobMatchDto[], meta: defaultMeta };
    }
    return { items: [], meta: defaultMeta };
  },

  async dismissJobMatch(candidateJobMatchId: string): Promise<void> {
    await apiClient.post(`/candidates/me/job-matches/${candidateJobMatchId}/dismiss`);
  },
};
