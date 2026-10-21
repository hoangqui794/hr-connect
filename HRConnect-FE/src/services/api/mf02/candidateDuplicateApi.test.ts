import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/services/apiClient';
import { candidateDuplicateApi } from './candidateDuplicateApi';

vi.mock('@/services/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

describe('candidateDuplicateApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads only the signed-in Candidate duplicate cases', async () => {
    const page = { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 };
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: page });

    await expect(candidateDuplicateApi.listMine({ status: 'UNDER_REVIEW', page: 1, pageSize: 10 })).resolves.toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/candidates/me/duplicate-cases', {
      params: { status: 'UNDER_REVIEW', page: 1, pageSize: 10 },
    });
  });

  it('previews before resolving an Admin merge with concurrency and idempotency protection', async () => {
    const preview = { duplicateCaseId: 'case-1', canMerge: true, concurrencyToken: 'token-2' };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: preview }).mockResolvedValueOnce({ data: { status: 'MERGED' } });

    await expect(candidateDuplicateApi.previewMerge('case-1')).resolves.toEqual(preview);
    await candidateDuplicateApi.resolve('case-1', {
      decision: 'MERGE',
      reason: 'Email đã xác minh và lịch sử CV trùng khớp.',
      concurrencyToken: 'token-2',
      idempotencyKey: 'attempt-1',
    });

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/admin/candidate-duplicate-cases/case-1/preview-merge');
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/admin/candidate-duplicate-cases/case-1/resolve', {
      decision: 'MERGE',
      reason: 'Email đã xác minh và lịch sử CV trùng khớp.',
      concurrencyToken: 'token-2',
      idempotencyKey: 'attempt-1',
    });
  });
});
