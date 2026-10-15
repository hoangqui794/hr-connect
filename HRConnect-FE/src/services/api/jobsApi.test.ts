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

describe('jobsApi MF-01 commercial terms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the commercial-terms defaults from the data envelope', async () => {
    const data = { serviceTypeCode: 'HEADHUNT_COD', prefill: { feeMultiplier: 1.5 } };
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data } });

    await expect(jobsApi.getCommercialTermsDefaults('job-1')).resolves.toEqual(data);
    expect(apiClient.get).toHaveBeenCalledWith('/internal/jobs/job-1/commercial-terms/defaults');
  });

  it('sends the agreed terms and agreement reference in the approve body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true } });

    await jobsApi.approve('job-1', 'token-1', {
      commercialTerms: { feeMultiplier: 1.2, warrantyDays: 60, paymentDueDays: 15 },
      agreementReference: 'HĐ-01',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/internal/jobs/job-1/approve',
      {
        concurrencyToken: 'token-1',
        commercialTerms: { feeMultiplier: 1.2, warrantyDays: 60, paymentDueDays: 15 },
        agreementReference: 'HĐ-01',
      },
      { params: { concurrencyToken: 'token-1' } }
    );
  });
});
