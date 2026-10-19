import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportApi } from './reportApi';
import { apiClient } from '@/services/apiClient';

vi.mock('@/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('reportApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getOverview calls /reports/overview with date params', async () => {
    const mockOverview = {
      jobs: { byStatus: {}, byServiceType: {} },
      applications: { submitted: 10, shortlisted: 5, interview: 3, placed: 1 },
      placements: { started: 1, warrantyPassed: 0, warrantyVoided: 0 },
      companies: { verified: 4, pending: 1 },
      affiliates: { active: 12, pending: 2 },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockOverview },
    });

    const res = await reportApi.getOverview({ from: '2026-10-01', to: '2026-10-19' });

    expect(apiClient.get).toHaveBeenCalledWith('/reports/overview', {
      params: { from: '2026-10-01', to: '2026-10-19' },
    });
    expect(res).toEqual(mockOverview);
  });

  it('getRevenue calls /reports/revenue with groupBy', async () => {
    const mockRevenue = {
      currency: 'VND',
      totals: { HEADHUNT_COD: { billed: 20000000, collected: 20000000 } },
      series: [],
      commission: { earned: 5000000, paid: 5000000 },
    };
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: mockRevenue },
    });

    const res = await reportApi.getRevenue({ from: '2026-10-01', to: '2026-10-19', groupBy: 'month' });

    expect(apiClient.get).toHaveBeenCalledWith('/reports/revenue', {
      params: { from: '2026-10-01', to: '2026-10-19', groupBy: 'month' },
    });
    expect(res).toEqual(mockRevenue);
  });

  it('getTopAffiliates calls /reports/top-affiliates', async () => {
    const mockTop = [{ affiliateId: 'aff-1', fullName: 'Nguyen A', totalSubmissions: 5, totalPlacements: 2, commissionEarned: 10000000 }];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { items: mockTop } },
    });

    const res = await reportApi.getTopAffiliates({ limit: 10 });

    expect(apiClient.get).toHaveBeenCalledWith('/reports/top-affiliates', {
      params: { limit: 10 },
    });
    expect(res).toEqual(mockTop);
  });

  it('getTopCompanies calls /reports/top-companies', async () => {
    const mockTop = [{ companyId: 'comp-1', companyName: 'FPT Software', activeJobs: 3, placements: 5, revenueCollected: 50000000 }];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { success: true, data: { items: mockTop } },
    });

    const res = await reportApi.getTopCompanies({ limit: 10 });

    expect(apiClient.get).toHaveBeenCalledWith('/reports/top-companies', {
      params: { limit: 10 },
    });
    expect(res).toEqual(mockTop);
  });
});
