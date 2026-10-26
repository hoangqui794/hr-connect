import { describe, it, expect, vi, beforeEach } from 'vitest';
import { candidateJobMatchApi } from './candidateJobMatchApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('candidateJobMatchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getJobMatches', () => {
    it('calls GET /candidates/me/job-matches and returns data from envelope', async () => {
      const mockMatches = [
        {
          candidateJobMatchId: 'match-1',
          jobId: 'job-1',
          jobTitle: 'Senior Frontend Engineer',
          companyName: 'FPT Software',
          location: 'Hà Nội',
          matchScore: 85,
          generatedAt: '2026-10-19T10:00:00Z',
          expiresAt: '2026-10-26T10:00:00Z',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: {
          success: true,
          data: mockMatches,
          meta: { hasPrimaryCv: true, lastGeneratedAt: '2026-10-19T10:00:00Z', scoringVersion: 'HYBRID_V1' },
        },
      } as any);

      const result = await candidateJobMatchApi.getJobMatches();
      expect(apiClient.get).toHaveBeenCalledWith('/candidates/me/job-matches');
      expect(result.items).toEqual(mockMatches);
      expect(result.meta.hasPrimaryCv).toBe(true);
    });

    it('handles direct array response without envelope', async () => {
      const mockMatches = [
        {
          candidateJobMatchId: 'match-2',
          jobId: 'job-2',
          jobTitle: 'Product Manager',
          companyName: 'VNG Corporation',
          location: 'TP. Hồ Chí Minh',
          matchScore: 92,
          generatedAt: '2026-10-19T11:00:00Z',
          expiresAt: '2026-10-26T11:00:00Z',
        },
      ];

      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: mockMatches,
      } as any);

      const result = await candidateJobMatchApi.getJobMatches();
      expect(result.items).toEqual(mockMatches);
    });

    it('returns empty array if response is empty or invalid', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: null,
      } as any);

      const result = await candidateJobMatchApi.getJobMatches();
      expect(result.items).toEqual([]);
    });
  });

  it('dismisses a suggestion through the Candidate endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true } } as any);

    await candidateJobMatchApi.dismissJobMatch('match-1');

    expect(apiClient.post).toHaveBeenCalledWith('/candidates/me/job-matches/match-1/dismiss');
  });
});
