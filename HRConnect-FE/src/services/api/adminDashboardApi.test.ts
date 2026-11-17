import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminDashboardApi } from './adminApi';
import { apiClient } from '../apiClient';
import type { AdminDashboardMetrics } from '@/types/api/admin';

vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

const metrics: AdminDashboardMetrics = {
  range: '7d',
  generatedAtUtc: '2026-11-17T05:00:00Z',
  currencyCode: 'VND',
  kpis: {
    pendingApprovals: 2,
    activeUsers: 17,
    suspendedUsers: 1,
    auditEventsToday: 4,
    overdueServiceFeesCount: 1,
    overdueServiceFeesAmount: 45_000_000,
    payableCommissionsCount: 2,
    payableCommissionsAmount: 18_500_000,
    openDisputesCount: 0,
  },
  cashflowSeries: [
    { date: '2026-11-17', serviceFeesPaidAmount: 1, refundsPaidAmount: 0, postingFeesPaidAmount: 0, payoutsAmount: 0 },
  ],
  activitySeries: [{ date: '2026-11-17', newUsers: 1, auditEvents: 4, approvalsCompleted: 0 }],
  userRoleBreakdown: [{ role: 'CANDIDATE', count: 3 }],
};

describe('adminDashboardApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['7d', '30d', '90d'] as const)('calls /admin/dashboard/metrics with range=%s and unwraps data', async (range) => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: metrics } });

    const result = await adminDashboardApi.getMetrics(range);

    expect(apiClient.get).toHaveBeenCalledWith('/admin/dashboard/metrics', { params: { range } });
    expect(result).toEqual(metrics);
  });

  it('propagates API errors (e.g. 403 without report.view)', async () => {
    const error = Object.assign(new Error('Forbidden'), { response: { status: 403 } });
    vi.mocked(apiClient.get).mockRejectedValueOnce(error);

    await expect(adminDashboardApi.getMetrics('30d')).rejects.toBe(error);
  });
});
