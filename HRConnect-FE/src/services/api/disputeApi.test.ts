import { describe, it, expect, vi, beforeEach } from 'vitest';
import { disputeApi } from './disputeApi';
import { apiClient } from '@/services/apiClient';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('disputeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createDispute calls POST /disputes', async () => {
    const mockCreated = {
      disputeId: 'dsp-1',
      disputeType: 'DUPLICATE_SUBMISSION',
      status: 'OPEN',
      submissionId: 'sub-1',
      jobTitle: 'Frontend Dev',
      candidateName: 'Trần Văn B',
      description: 'Lượt nộp bị chặn',
      resolution: null,
      createdAt: '2026-10-19T00:00:00Z',
      resolvedAt: null,
    };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: mockCreated },
    });

    const res = await disputeApi.createDispute({
      disputeType: 'DUPLICATE_SUBMISSION',
      submissionId: 'sub-1',
      description: 'Lượt nộp bị chặn',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/disputes', {
      disputeType: 'DUPLICATE_SUBMISSION',
      submissionId: 'sub-1',
      description: 'Lượt nộp bị chặn',
    });
    expect(res).toEqual(mockCreated);
  });

  it('getMyDisputes calls GET /disputes/mine', async () => {
    const mockList = [{ disputeId: 'dsp-1', status: 'OPEN' }];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockList },
    });

    const res = await disputeApi.getMyDisputes('OPEN');

    expect(apiClient.get).toHaveBeenCalledWith('/disputes/mine', {
      params: { status: 'OPEN' },
    });
    expect(res).toEqual(mockList);
  });

  it('getAdminDisputes calls GET /admin/disputes', async () => {
    const mockPage = { items: [{ disputeId: 'dsp-2' }], totalCount: 1, page: 1, pageSize: 20 };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockPage },
    });

    const res = await disputeApi.getAdminDisputes({ status: 'OPEN' });

    expect(apiClient.get).toHaveBeenCalledWith('/admin/disputes', {
      params: { status: 'OPEN' },
    });
    expect(res).toEqual(mockPage);
  });

  it('resolveDispute calls POST /admin/disputes/:id/resolve', async () => {
    const mockResolved = { disputeId: 'dsp-1', status: 'UPHELD', resolution: 'Chấp thuận' };
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { success: true, data: mockResolved },
    });

    const res = await disputeApi.resolveDispute('dsp-1', {
      decision: 'UPHELD',
      resolution: 'Chấp thuận',
      concurrencyToken: 'token-1',
      idempotencyKey: 'resolve-attempt-1',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/admin/disputes/dsp-1/resolve', {
      decision: 'UPHELD',
      resolution: 'Chấp thuận',
      concurrencyToken: 'token-1',
      idempotencyKey: 'resolve-attempt-1',
    });
    expect(res).toEqual(mockResolved);
  });
});
