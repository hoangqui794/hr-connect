import { describe, it, expect, vi, beforeEach } from 'vitest';
import { candidateJobMatchApi } from './candidateJobMatchApi';
import { apiClient } from '../apiClient';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
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
        },
      } as any);

      const result = await candidateJobMatchApi.getJobMatches();
      expect(apiClient.get).toHaveBeenCalledWith('/candidates/me/job-matches');
      expect(result).toEqual(mockMatches);
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
      expect(result).toEqual(mockMatches);
    });

    it('returns empty array if response is empty or invalid', async () => {
      vi.mocked(apiClient.get).mockResolvedValueOnce({
        data: null,
      } as any);

      const result = await candidateJobMatchApi.getJobMatches();
      expect(result).toEqual([]);
    });
  });
});
