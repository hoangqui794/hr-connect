import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../apiClient';
import { jobsApi } from './jobsApi';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('jobsApi public catalog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the anonymous Candidate-scoped endpoint and removes empty filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { items: [], page: 1, pageSize: 12, totalCount: 0, totalPages: 0 },
    });

    await jobsApi.searchPublic({
      search: '',
      location: undefined,
      employmentType: 'FULL_TIME',
      page: 1,
      pageSize: 12,
    });

    expect(apiClient.get).toHaveBeenCalledWith('/public/jobs', {
      params: { employmentType: 'FULL_TIME', page: 1, pageSize: 12 },
    });
  });
});
